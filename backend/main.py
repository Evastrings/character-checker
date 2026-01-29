from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from PIL import Image
import numpy as np
from sklearn.cluster import KMeans
from google import genai  # NEW IMPORT
import os
import io
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Character Consistency Checker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://character-checker.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini with NEW SDK
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# Get port from environment
PORT = int(os.getenv("PORT", 8000))

# existing color extraction functions
def extract_dominant_colors(image_path, n_colors=5, resize_dim=(100, 100)):
    """Extract dominant colors from an image using K-means clustering."""
    im = Image.open(image_path)
    size = resize_dim
    im2 = im.resize(size)
    im2_array = np.asarray(im2)
    h, w, rgb = im2_array.shape
    im2_array_2d = im2_array.reshape((h*w, rgb))
    im2_resize_kmeans = KMeans(n_clusters=n_colors, random_state=0, n_init="auto").fit(im2_array_2d)
    my_colors = im2_resize_kmeans.cluster_centers_
    im2_labels = im2_resize_kmeans.labels_
    color_group = np.bincount(im2_labels)
    color_percent = (color_group*100)/len(im2_labels)
    return my_colors, color_percent

def rgb_to_hex(rgb_color):
    """Convert an RGB color to HEX format."""
    r, g, b = rgb_color
    cat2 = '#'
    for value in [r, g, b]:
        cat2 = cat2 + format(int(value), '02x')
    return cat2

def extract_palette(image_path, n_colors=5):
    """Extract color palette with hex codes and percentages"""
    colors, percentages = extract_dominant_colors(image_path, n_colors)
    palette = []
    for i in range(n_colors):
        rgb = colors[i].astype(int)
        hex_color = rgb_to_hex(rgb)
        palette.append({
            'hex': hex_color,
            'rgb': rgb.tolist(),
            'percentage': round(float(percentages[i]), 2)
        })
    return sorted(palette, key=lambda x: x['percentage'], reverse=True)

def compare_palettes(palette1, palette2):
    """Compare two palettes and return similarity score"""
    top_colors_1 = set([c['hex'] for c in palette1[:3]])
    top_colors_2 = set([c['hex'] for c in palette2[:3]])
    matches = len(top_colors_1.intersection(top_colors_2))
    similarity = (matches / 3.0) * 100
    return similarity

def analyze_with_gemini(image_paths):
    """Use Gemini Vision to analyze character consistency - NEW SDK"""
    
    # Load images as bytes
    images = []
    for path in image_paths:
        with open(path, 'rb') as f:
            images.append({
                'mime_type': 'image/png',
                'data': f.read()
            })
    
    prompt = f"""You are an expert character designer analyzing {len(images)} images to determine if they show the same character.

**Your task:** Evaluate how consistent this character is across all images.

**Scoring Guidelines:**
- 95-100: Identical or near-identical (same image, same character, same style, minimal differences)
- 85-94: Highly consistent (clearly same character, minor variations in pose/angle)
- 70-84: Moderately consistent (same character, noticeable style or proportion differences)
- 50-69: Somewhat consistent (could be same character, significant differences)
- 0-49: Inconsistent (likely different characters or major redesigns)

**Analyze these aspects:**
1. **Physical Features**: Hair (style, length, color), eyes (shape, color), face structure, body proportions
2. **Character Identity**: Are these recognizably the same character?
3. **Art Style**: Consistent drawing style, line work quality, shading technique
4. **Distinctive Features**: Unique markings, accessories, clothing elements

**IMPORTANT:** 
- If images appear identical or nearly identical, score should be 95-100
- Focus on CHARACTER features, not backgrounds or minor pose changes
- Be specific about what makes the character consistent or inconsistent

Provide your analysis in this EXACT format:

CONSISTENCY_SCORE: [single number from 0-100]

KEY_FEATURES:
- [List 3-5 defining features that SHOULD stay consistent]
- [Focus on the most distinctive/recognizable features]

ISSUES:
- [List any inconsistencies found, or write "None detected - character maintains excellent consistency"]
- [Be specific: "Eye color changes from blue to green in image 2"]

RECOMMENDATIONS:
- [Provide 2-3 actionable tips to maintain or improve consistency]
- [Be practical and specific to what you observed]

Focus on character identity and defining features. Ignore backgrounds, poses, and minor artistic variations."""

    # Try models with fallbacks
    model_names = [
        'gemini-2.0-flash-thinking-exp-01-21',
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash',
    ]
    
    for model_name in model_names:
        try:
            # Build content
            contents = [prompt]
            for img in images:
                contents.append(img)
            
            response = client.models.generate_content(
                model=model_name,
                contents=contents
            )
            
            return response.text
            
        except Exception as e:
            print(f"Model {model_name} failed: {e}")
            continue
    
    raise Exception("All Gemini models failed")

def parse_ai_response(text):
    """Parse AI's structured response"""
    lines = text.split('\n')
    result = {
        'consistency_score': 0,
        'key_features': [],
        'issues': [],
        'recommendations': []
    }
    
    current_section = None
    for line in lines:
        line = line.strip()
        
        if line.startswith('CONSISTENCY_SCORE:'):
            try:
                score_text = line.split(':')[1].strip()
                result['consistency_score'] = int(''.join(filter(str.isdigit, score_text)))
            except:
                result['consistency_score'] = 75
                
        elif line.startswith('KEY_FEATURES:'):
            current_section = 'key_features'
        elif line.startswith('ISSUES:'):
            current_section = 'issues'
        elif line.startswith('RECOMMENDATIONS:'):
            current_section = 'recommendations'
        elif line and current_section:
            clean_line = line.lstrip('-•* ').strip()
            if clean_line and not clean_line.endswith(':'):
                result[current_section].append(clean_line)
    
    return result

@app.get("/")
def read_root():
    return {"status": "Character Checker API is running with Gemini AI"}

@app.post("/analyze")
async def analyze_character(files: List[UploadFile] = File(...)):
    """Accept 2-5 images, analyze with color extraction + Gemini Vision"""
    
    if len(files) < 2 or len(files) > 5:
        return {"error": "Please upload 2-5 images"}
    
    os.makedirs("temp_uploads", exist_ok=True)
    
    image_paths = []
    palettes = []
    
    for idx, file in enumerate(files):
        file_path = f"temp_uploads/image_{idx}.png"
        
        content = await file.read()
        
        try:
            img = Image.open(io.BytesIO(content))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            max_size = 2048
            if max(img.size) > max_size:
                ratio = max_size / max(img.size)
                new_size = tuple(int(dim * ratio) for dim in img.size)
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            
            img.save(file_path, 'PNG')
            
        except Exception as e:
            print(f"Error processing image {idx}: {e}")
            with open(file_path, "wb") as f:
                f.write(content)
        
        image_paths.append(file_path)
        palette = extract_palette(file_path)
        palettes.append(palette)
    
    # Color similarity
    palette_similarities = []
    for i in range(len(palettes)):
        for j in range(i + 1, len(palettes)):
            sim = compare_palettes(palettes[i], palettes[j])
            palette_similarities.append(sim)
    
    avg_color_similarity = sum(palette_similarities) / len(palette_similarities) if palette_similarities else 0
    
    # Gemini analysis
    try:
        gemini_analysis = analyze_with_gemini(image_paths)
        parsed = parse_ai_response(gemini_analysis)
        consistency_score = parsed['consistency_score']
        
        if avg_color_similarity < 30 and consistency_score < 70:
            parsed['issues'].append(f"Color palette shows variation ({round(avg_color_similarity)}% similarity) - may be due to different backgrounds or lighting")
        elif avg_color_similarity >= 60:
            if "excellent consistency" not in str(parsed['recommendations']).lower():
                parsed['recommendations'].append(f"Color palette is consistent ({round(avg_color_similarity)}% similarity)")
        
        if consistency_score >= 95 and not any("None detected" in issue for issue in parsed['issues']):
            parsed['issues'] = ["None detected - character maintains excellent consistency"]
        
    except Exception as e:
        print(f"Gemini API error: {e}")
        consistency_score = round(avg_color_similarity)
        parsed = {
            'key_features': ["Unable to analyze features - using color analysis only"],
            'issues': [f"AI analysis unavailable: {str(e)}"],
            'recommendations': ["Please try again or check API configuration"]
        }
    
    return {
        "consistency_score": consistency_score,
        "num_images_analyzed": len(files),
        "key_features": parsed['key_features'],
        "issues": parsed['issues'],
        "recommendations": parsed['recommendations'],
        "color_analysis": {
            "palettes": palettes,
            "dominant_colors": palettes[0][:3],
            "color_similarity": round(avg_color_similarity, 2)
        },
        "analysis_type": "Gemini AI Vision + Color Analysis",
        "model": "gemini-2.0-flash-thinking"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)