'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface SilverParagraphCardProps {
  paragraphNumber: number;
  total: number;
  content: string;
  missingWord: string;
  onCorrect: () => void;
  onIncorrect: () => void;
  onSubmit?: (answer: string) => Promise<void>;
}

export default function SilverParagraphCard({
  paragraphNumber,
  total,
  content,
  missingWord,
  onCorrect,
  onIncorrect,
  onSubmit,
}: SilverParagraphCardProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!userAnswer.trim() || isLoading) return;

    setIsLoading(true);
    setIsSubmitted(true);

    const correct = userAnswer.trim().toLowerCase() === missingWord.toLowerCase();
    setIsCorrect(correct);

    if (correct) {
      if (onSubmit) {
        await onSubmit(userAnswer);
      }
      onCorrect();
    } else {
      onIncorrect();
    }

    setIsLoading(false);
  };

  const contentParts = content.split('_____');

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">

      {/* Paragraph Number */}
      <div className="text-center mb-4">
        <span className="text-xs font-semibold text-[#6C63FF] bg-[#6C63FF]/10 px-3 py-1 rounded-full">
          📝 Paragraph {paragraphNumber}/{total}
        </span>
      </div>

      {/* Content */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="text-gray-700 leading-relaxed">
          {contentParts.map((part, index) => (
            <span key={index}>
              {part}
              {index < contentParts.length - 1 && (
                <span className="inline-block">
                  {isSubmitted && isCorrect ? (
                    <span className="text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded">
                      {missingWord}
                    </span>
                  ) : isSubmitted && !isCorrect ? (
                    <span className="text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded line-through">
                      {userAnswer || '____'}
                    </span>
                  ) : (
                    <span className="text-purple-600 font-bold bg-purple-100 px-2 py-0.5 rounded">
                      _____
                    </span>
                  )}
                </span>
              )}
            </span>
          ))}
        </p>
      </div>

      {/* Input */}
      {!isSubmitted || !isCorrect ? (
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">
            Fill in the missing word:
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type the missing word..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent"
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading || !userAnswer.trim()}
              className="px-6 py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '...' : 'Submit'}
            </button>
          </div>
          {isSubmitted && !isCorrect && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Incorrect! Please try again.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-sm font-semibold text-green-700 flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            ✅ Correct! Moving on...
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs text-amber-700">
          💡 Hint: The missing word is a noun that completes the sentence.
        </p>
      </div>
    </div>
  );
}