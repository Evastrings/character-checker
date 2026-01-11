'use client';

import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Sparkles, Palette } from 'lucide-react';

export default function Home() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setFiles(files);
    setError(null);
    
    // Create previews
    const newPreviews: string[] = [];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        if (newPreviews.length === files.length) {
          setPreviews(newPreviews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files) return;

    if (files.length < 2 || files.length > 5) {
      setError('Please upload 2-5 images');
      return;
    }

    setLoading(true);
    setError(null);
    const formData = new FormData();
    
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('Analysis failed');
      }
      
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to analyze images. Please try again.');
    }
    setLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'from-green-500 to-emerald-600';
    if (score >= 70) return 'from-blue-500 to-cyan-600';
    if (score >= 50) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
              AI Character Consistency Checker
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Ensure your anime character looks consistent across all designs
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Powered by Gemini AI Vision + Custom ML Color Analysis
          </p>
        </header>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
              <Upload className="w-6 h-6 text-blue-600" />
              Upload Images
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-gray-50">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-2">
                    Click to upload 2-5 character images
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, or WEBP (Max 10MB each)
                  </p>
                </label>
              </div>
              
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              {previews.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    {previews.length} image{previews.length > 1 ? 's' : ''} selected
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {previews.map((preview, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={preview}
                          alt={`Preview ${i + 1}`}
                          className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading || !files}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 
                  rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all
                  shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing Character...
                  </span>
                ) : (
                  'Analyze Consistency'
                )}
              </button>
            </form>
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Analysis Results</h2>
            
            {!result && !loading && (
              <div className="text-center py-16 text-gray-400">
                <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Upload images to see AI analysis</p>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                {/* Score */}
                <div className="text-center p-8 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-gray-200">
                  <div className={`text-6xl font-bold mb-2 bg-gradient-to-r ${getScoreColor(result.consistency_score)} bg-clip-text text-transparent`}>
                    {result.consistency_score}%
                  </div>
                  <div className="text-sm font-medium text-gray-600">
                    Consistency Score
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Based on {result.num_images_analyzed} images
                  </div>
                </div>

                {/* Key Features */}
                {result.key_features && result.key_features.length > 0 && (
                  <div className="p-5 bg-blue-50 rounded-xl border border-blue-100">
                    <h3 className="font-bold mb-3 flex items-center gap-2 text-blue-900">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                      Key Character Features
                    </h3>
                    <ul className="space-y-2">
                      {result.key_features.map((feature: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Issues */}
                {result.issues && result.issues.length > 0 && (
                  <div className="p-5 bg-red-50 rounded-xl border border-red-100">
                    <h3 className="font-bold mb-3 flex items-center gap-2 text-red-900">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      Issues Found
                    </h3>
                    <ul className="space-y-2">
                      {result.issues.map((issue: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <div className="p-5 bg-green-50 rounded-xl border border-green-100">
                    <h3 className="font-bold mb-3 flex items-center gap-2 text-green-900">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {result.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                          <span className="text-green-500 mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Color Palette */}
                {result.color_analysis && result.color_analysis.dominant_colors && (
                  <div className="p-5 bg-purple-50 rounded-xl border border-purple-100">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-purple-900">
                      <Palette className="w-5 h-5 text-purple-600" />
                      Dominant Color Palette
                    </h3>
                    <div className="flex gap-3">
                      {result.color_analysis.dominant_colors.map((color: any, i: number) => (
                        <div key={i} className="flex-1 text-center">
                          <div
                            className="w-full h-20 rounded-lg mb-2 border-2 border-white shadow-md"
                            style={{ backgroundColor: color.hex }}
                          />
                          <div className="text-xs font-mono font-semibold text-gray-700">
                            {color.hex}
                          </div>
                          <div className="text-xs text-gray-600">
                            {color.percentage}%
                          </div>
                        </div>
                      ))}
                    </div>
                    {result.color_analysis.color_similarity !== undefined && (
                      <div className="mt-4 text-xs text-center text-purple-700 bg-purple-100 py-2 rounded-lg">
                        Color Similarity: {result.color_analysis.color_similarity}%
                      </div>
                    )}
                  </div>
                )}

                {/* Analysis Type Badge */}
                <div className="text-center">
                  <span className="inline-block px-4 py-2 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">
                    {result.analysis_type || 'AI Vision + Color Analysis'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}