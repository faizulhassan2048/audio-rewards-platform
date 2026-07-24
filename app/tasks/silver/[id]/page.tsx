'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
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
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showNativeAd, setShowNativeAd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(15);
  const [isLevelComplete, setIsLevelComplete] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Timer 10 seconds
  const [adTimerSeconds, setAdTimerSeconds] = useState(10);
  const [isAdTimerRunning, setIsAdTimerRunning] = useState(false);
  
  // Retry state
  const [showRetry, setShowRetry] = useState(false);

  const mountRef = useRef(true);

  // Timer effect – 10 seconds
  useEffect(() => {
    if (showNativeAd) {
      setAdTimerSeconds(10);
      setIsAdTimerRunning(true);
      
      const timer = setInterval(() => {
        setAdTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsAdTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    } else {
      setAdTimerSeconds(10);
      setIsAdTimerRunning(false);
      setShowRetry(false);
    }
  }, [showNativeAd]);

  // Fetch latest status (used for navigation and retry)
  const fetchLatestStatus = async () => {
    try {
      const res = await fetch('/api/tasks/silver/status', { cache: 'no-store' });
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  // Load paragraph
  useEffect(() => {
    const loadParagraph = async () => {
      try {
        const statusData = await fetchLatestStatus();
        if (!statusData) {
          router.push('/tasks/silver');
          return;
        }

        if (statusData.level_complete) {
          router.push('/tasks/silver?complete=true');
          return;
        }

        // If wrong paragraph, redirect
        if (statusData.current_paragraph?.id !== paragraphId) {
          const next = statusData.current_paragraph;
          if (next) {
            const nextNum = (statusData.completed_paragraphs || 0) + 1;
            router.replace(`/tasks/silver/${next.id}?number=${nextNum}&total=${totalCount}`);
          } else {
            router.push('/tasks/silver');
          }
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const number = parseInt(params.get('number') || '1');
        const total = parseInt(params.get('total') || '15');
        setTotalCount(total);

        const res = await fetch(`/api/tasks/silver/paragraph/${paragraphId}`, { cache: 'no-store' });
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

        setCompletedCount(number - 1);
        // Reset all states for new paragraph
        setUserAnswer('');
        setIsSubmitted(false);
        setIsCorrect(false);
        setShowNativeAd(false);
        setShowRetry(false);
        setIsNavigating(false);
      } catch (error) {
        console.error('Error:', error);
        toast.error('Could not load paragraph');
        router.push('/tasks/silver');
      } finally {
        setLoading(false);
      }
    };

    loadParagraph();
  }, [paragraphId, router, totalCount]);

  const handleSubmit = async () => {
    if (isSubmitting || isNavigating || !paragraph) return;
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

    // ✅ Always show native ad after correct answer (before API call)
    setShowNativeAd(true);

    try {
      const res = await fetch('/api/tasks/silver/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          paragraph_id: paragraphId,
          paragraph_number: paragraph.paragraph_number,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        toast.error(data.error || 'Could not save progress');
        // Keep ad showing, user can retry navigation later
        setIsSubmitting(false);
        return;
      }

      setCompletedCount(data.completed_paragraphs || paragraph.paragraph_number);

      if (data.level_complete) {
        setIsLevelComplete(true);
      }

      // If next_paragraph is returned, store it for navigation (optional)
      // We'll rely on fetchLatestStatus in handleNativeAdComplete anyway

    } catch (error) {
      console.error('Error submitting:', error);
      toast.error('Network error, but you can continue');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Reliable navigation: after ad timer ends, fetch fresh status
  const handleNativeAdComplete = async () => {
    if (isAdTimerRunning || isNavigating) return;
    setIsNavigating(true);
    setShowNativeAd(false);

    if (isLevelComplete) {
      router.push('/tasks/silver?complete=true');
      return;
    }

    // ✅ Wait 300ms for DB commit, then fetch fresh status
    await new Promise(resolve => setTimeout(resolve, 300));
    const status = await fetchLatestStatus();

    if (!status) {
      setShowRetry(true);
      setIsNavigating(false);
      return;
    }

    if (status.level_complete) {
      router.push('/tasks/silver?complete=true');
      return;
    }

    // ✅ Get next paragraph from status
    const next = status.current_paragraph;
    if (next && next.id !== paragraphId) {
      const nextNum = (status.completed_paragraphs || 0) + 1;
      router.push(`/tasks/silver/${next.id}?number=${nextNum}&total=${totalCount}`);
    } else {
      // ❌ No new paragraph – show retry
      setShowRetry(true);
      setIsNavigating(false);
    }
  };

  // ✅ Manual retry
  const handleRetry = async () => {
    setShowRetry(false);
    setIsNavigating(true);
    toast.info('🔄 Retrying...');

    await new Promise(resolve => setTimeout(resolve, 300));
    const status = await fetchLatestStatus();

    if (status?.current_paragraph && status.current_paragraph.id !== paragraphId) {
      const nextNum = (status.completed_paragraphs || 0) + 1;
      router.push(`/tasks/silver/${status.current_paragraph.id}?number=${nextNum}&total=${totalCount}`);
    } else {
      setShowRetry(true);
      setIsNavigating(false);
      toast.error('Could not load next paragraph. Please try again.');
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
          <p className="text-gray-500 mb-4">Loading next paragraph...</p>
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
                  disabled={isSubmitting || !userAnswer.trim() || isNavigating}
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

          {showNativeAd ? (
            <div className="mt-4 space-y-4">
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-purple-600 text-center mb-2">
                  {isLevelComplete 
                    ? '🎉 Level Complete! Claim your reward!' 
                    : `📢 Paragraph ${paragraph.paragraph_number}/${totalCount} Complete!`}
                </p>
                <NativeBanner />
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>
                  {isAdTimerRunning 
                    ? `Please wait ${adTimerSeconds}s...` 
                    : '✅ Ready to continue!'}
                </span>
              </div>

              <button
                onClick={handleNativeAdComplete}
                disabled={isAdTimerRunning || isNavigating}
                className={`w-full py-4 px-6 rounded-xl font-bold transition-all ${
                  isAdTimerRunning || isNavigating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:scale-[1.02]'
                }`}
              >
                {isAdTimerRunning 
                  ? `⏳ Wait ${adTimerSeconds}s...` 
                  : isNavigating 
                    ? '⏳ Loading...' 
                    : isLevelComplete 
                      ? '🎉 Claim Reward & Continue' 
                      : '✅ Continue to Next Paragraph'}
              </button>

              {showRetry && (
                <button
                  onClick={handleRetry}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Loading Next Paragraph
                </button>
              )}
            </div>
          ) : (
            // ✅ If no native ad (e.g., after refresh), show a manual refresh button
            isSubmitted && isCorrect && !showNativeAd && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <p className="text-sm text-blue-700">✅ Answer submitted!</p>
                <button
                  onClick={() => {
                    setShowNativeAd(true);
                  }}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Continue to Ad
                </button>
              </div>
            )
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