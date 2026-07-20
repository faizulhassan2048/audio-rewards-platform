'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import TopBanner from '@/components/ads/TopBanner';
import BottomBanner from '@/components/ads/BottomBanner';
import NativeBanner from '@/components/ads/NativeBanner';

interface ParagraphData {
  id: string;
  paragraph_number: number;
  content: string;
  missing_word: string;
  total: number;
}

export default function SilverParagraphPage() {
  const router = useRouter();
  const params = useParams();
  const paragraphId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [paragraph, setParagraph] = useState<ParagraphData | null>(null);
  const [nextParagraph, setNextParagraph] = useState<ParagraphData | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showNativeAd, setShowNativeAd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(15);
  const [isLevelComplete, setIsLevelComplete] = useState(false);

  const mountRef = useRef(true);

  useEffect(() => {
    const checkAndFetch = async () => {
      try {
        const statusRes = await fetch('/api/tasks/silver/status');
        const statusText = await statusRes.text();
        const statusData = statusText ? JSON.parse(statusText) : null;
        
        if (statusData?.current_paragraph?.id !== paragraphId) {
          const params = new URLSearchParams(window.location.search);
          const total = parseInt(params.get('total') || '15');
          
          if (statusData?.current_paragraph) {
            const nextNumber = (statusData.completed_paragraphs || 0) + 1;
            router.replace(
              `/tasks/silver/${statusData.current_paragraph.id}?number=${nextNumber}&total=${total}`
            );
            return;
          }
          
          if (statusData?.level_complete) {
            router.replace('/tasks/silver?complete=true');
            return;
          }
          
          router.replace('/tasks/silver');
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const number = parseInt(params.get('number') || '1');
        const total = parseInt(params.get('total') || '15');
        setTotalCount(total);

        const res = await fetch(`/api/tasks/silver/paragraph/${paragraphId}`);
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;

        if (!res.ok || !data) {
          toast.error('Paragraph not found');
          router.push('/tasks/silver');
          return;
        }

        setParagraph({
          ...data,
          paragraph_number: number,
          total: total
        });

        if (statusData) {
          setCompletedCount(statusData.completed_paragraphs || 0);
        }
      } catch (error) {
        console.error('Error fetching paragraph:', error);
        toast.error('Could not load paragraph');
        router.push('/tasks/silver');
      } finally {
        setLoading(false);
      }
    };

    checkAndFetch();
  }, [paragraphId, router]);

  const handleSubmit = async () => {
    if (isSubmitting || !paragraph) return;
    setIsSubmitting(true);
    setIsSubmitted(true);

    const correct = userAnswer.trim().toLowerCase() === paragraph.missing_word.toLowerCase();
    setIsCorrect(correct);

    if (!correct) {
      toast.error('❌ Incorrect! Try again.');
      setIsSubmitted(false);
      setIsSubmitting(false);
      return;
    }

    toast.success('✅ Correct!');

    try {
      const res = await fetch('/api/tasks/silver/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paragraph_id: paragraphId,
          paragraph_number: paragraph.paragraph_number,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      // ✅ Handle "Already completed" gracefully
      if (data.alreadyCompleted || data.error === 'Already completed') {
        toast.info('⏩ Already completed! Moving to next...');
        
        if (data.next_paragraph) {
          const nextNumber = (paragraph?.paragraph_number || 0) + 1;
          setTimeout(() => {
            router.push(`/tasks/silver/${data.next_paragraph.id}?number=${nextNumber}&total=${totalCount}`);
          }, 1000);
          return;
        }
        
        if (data.level_complete) {
          router.push('/tasks/silver?complete=true');
          return;
        }
        
        const statusRes = await fetch('/api/tasks/silver/status');
        const statusText = await statusRes.text();
        const statusData = statusText ? JSON.parse(statusText) : null;
        
        if (statusData?.current_paragraph) {
          const nextNumber = (paragraph?.paragraph_number || 0) + 1;
          router.push(`/tasks/silver/${statusData.current_paragraph.id}?number=${nextNumber}&total=${totalCount}`);
        } else {
          router.push('/tasks/silver');
        }
        return;
      }

      // ✅ No AD_REQUIRED - always show Native Banner
      if (!res.ok) {
        toast.error(data.error || 'Could not save progress');
        setIsSubmitting(false);
        setIsSubmitted(false);
        return;
      }

      setCompletedCount(data.completed_paragraphs || paragraph.paragraph_number);
      setNextParagraph(data.next_paragraph || null);

      if (data.level_complete) {
        setIsLevelComplete(true);
        setShowNativeAd(true);
        setIsSubmitting(false);
        return;
      }

      // ✅ Always show Native Banner after EVERY paragraph
      setShowNativeAd(true);
      setIsSubmitting(false);

    } catch (error) {
      console.error('Error submitting:', error);
      toast.error('Network error');
      setIsSubmitted(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNativeAdComplete = () => {
    setShowNativeAd(false);

    if (isLevelComplete) {
      router.push('/tasks/silver?complete=true');
      return;
    }

    if (nextParagraph) {
      const nextNumber = (paragraph?.paragraph_number || 0) + 1;
      router.push(`/tasks/silver/${nextParagraph.id}?number=${nextNumber}&total=${totalCount}`);
    } else {
      router.push('/tasks/silver');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6C63FF]" />
      </div>
    );
  }

  if (!paragraph) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Paragraph not found</p>
          <Link href="/tasks/silver" className="text-[#6C63FF] hover:underline">
            Back to Level
          </Link>
        </div>
      </div>
    );
  }

  const contentParts = paragraph.content.split('_____');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-6 pb-32">
      <div className="max-w-md mx-auto">

        <div className="mb-3">
          <TopBanner />
        </div>

        <Link
          href="/tasks/silver"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#6C63FF] mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Level
        </Link>

        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500">
            Paragraph <span className="font-semibold text-gray-700">{paragraph.paragraph_number}</span> of <span className="font-semibold text-gray-700">{totalCount}</span>
          </span>
          <span className="font-medium text-[#6C63FF]">
            {Math.round((completedCount / totalCount) * 100)}%
          </span>
        </div>

        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-[#6C63FF] to-purple-500 transition-all duration-300 rounded-full"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">

          <div className="text-center mb-4">
            <span className="text-xs font-semibold text-[#6C63FF] bg-[#6C63FF]/10 px-3 py-1 rounded-full">
              📝 Paragraph {paragraph.paragraph_number}/{totalCount}
            </span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-gray-700 leading-relaxed">
              {contentParts.map((part, index) => (
                <span key={index}>
                  {part}
                  {index < contentParts.length - 1 && (
                    <span className="inline-block">
                      {isSubmitted && isCorrect ? (
                        <span className="text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded">
                          {paragraph.missing_word}
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
                  disabled={isSubmitting || isSubmitted}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent"
                />
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !userAnswer.trim()}
                  className="px-6 py-3 bg-[#6C63FF] text-white rounded-xl font-semibold hover:bg-[#5a52e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '✓' : 'Submit'}
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
                ✅ Correct!
              </p>
            </div>
          )}

          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-sm font-medium text-green-800">
              💡 <span className="font-bold">Hint:</span> The missing word is: <span className="font-bold text-green-700 underline">{paragraph.missing_word}</span>
            </p>
          </div>

          {/* ✅ Native Banner - Shows AFTER EVERY paragraph completion */}
          {showNativeAd && (
            <div className="mt-4 space-y-4">
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-purple-600 text-center mb-2">
                  {isLevelComplete 
                    ? '🎉 Level Complete! Claim your reward!' 
                    : `📢 Paragraph ${paragraph.paragraph_number}/${totalCount} Complete!`}
                </p>
                <NativeBanner />
              </div>
              <button
                onClick={handleNativeAdComplete}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                {isLevelComplete ? '🎉 Claim Reward & Continue' : '✅ Continue to Next Paragraph'}
              </button>
            </div>
          )}
        </div>

        <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-40 pointer-events-none">
          <div className="max-w-md mx-auto px-4 pointer-events-auto">
            <BottomBanner />
          </div>
        </div>

      </div>
    </div>
  );
}