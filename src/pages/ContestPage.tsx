import React, { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Check, Clock, Gift, Loader2 } from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';

const LIVE_WORKER_URL = 'https://ib-v2.hsgglobalpteltd.workers.dev';

interface ContestPageProps {
  initialContestId?: string | null;
  onBack: () => void;
}

export const ContestPage: React.FC<ContestPageProps> = ({
  initialContestId,
  onBack,
}) => {
  const { db, submitContestEntry, claimReward, showToast } = useHsgData();
  const [selectedContestId, setSelectedContestId] = useState<string>(
    initialContestId || db.contests[0]?.id || ''
  );
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [claimDeliveryMode, setClaimDeliveryMode] = useState<'collect' | 'delivery'>(
    'collect'
  );
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (initialContestId) {
      setSelectedContestId(initialContestId);
    } else if (!selectedContestId && db.contests[0]?.id) {
      setSelectedContestId(db.contests[0].id);
    }
  }, [initialContestId, db.contests, selectedContestId]);

  const contest =
    db.contests.find((c) => c.id === selectedContestId) || db.contests[0] || null;

  const handleSetAnswer = (qId: string, val: any) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const handleUploadAnswerPhoto = async (
    qId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(qId);
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `hsgplus_contest_entries/${Date.now()}_${cleanName}`;
      const res = await fetch(
        `${LIVE_WORKER_URL}/api/upload?filename=${encodeURIComponent(fileName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        }
      );
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      if (data.url) {
        handleSetAnswer(qId, data.url);
        showToast('Photo uploaded');
      }
    } catch {
      showToast('Failed to upload photo');
    } finally {
      setUploadingField(null);
    }
  };

  const questionsList = React.useMemo(() => {
    if (!contest) return [];
    if (
      Array.isArray(contest.submission_questions) &&
      contest.submission_questions.length > 0
    ) {
      return contest.submission_questions;
    }
    return (contest.questions || []).map((q) => ({
      id: q.id,
      label: q.label,
      type: q.type === 'scale' ? 'range_number' : q.type,
      required: q.required,
      options: [],
    }));
  }, [contest]);

  const postersList = React.useMemo(() => {
    if (!contest) return [];
    if (Array.isArray(contest.poster_images) && contest.poster_images.length > 0) {
      return contest.poster_images.slice(0, 8);
    }
    if (contest.frontpage_config?.cover_photo_url) {
      return [contest.frontpage_config.cover_photo_url];
    }
    return [];
  }, [contest]);

  const totalSubmissionsCount = React.useMemo(() => {
    if (!contest) return 0;
    return db.contest_submissions.filter((s) => s.contest_id === contest.id)
      .length;
  }, [contest, db.contest_submissions]);

  const userSubmissionsCount = React.useMemo(() => {
    if (!contest || !db.user?.phone_number) return 0;
    return db.contest_submissions.filter(
      (s) =>
        s.contest_id === contest.id && s.user_phone === db.user?.phone_number
    ).length;
  }, [contest, db.contest_submissions, db.user?.phone_number]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contest) return;

    const maxPerUser = Number(contest.submission_limits?.max_per_user || 0);
    const totalCap = Number(contest.submission_limits?.total_cap || 0);

    if (totalCap > 0 && totalSubmissionsCount >= totalCap) {
      showToast('This contest has reached its maximum submission limit.');
      return;
    }
    if (maxPerUser > 0 && userSubmissionsCount >= maxPerUser) {
      showToast(`You have reached the limit of ${maxPerUser} submission(s).`);
      return;
    }

    for (const q of questionsList) {
      const val = answers[q.id];
      if (q.required !== false) {
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0)
        ) {
          showToast(`Please complete: ${q.label}`);
          return;
        }
      }
    }

    submitContestEntry(answers, undefined, contest.id);
    setAnswers({});
  };

  // Countdown parts
  const getCountdownParts = () => {
    if (!contest?.end_timestamp) return null;
    const target =
      contest.start_timestamp && now < contest.start_timestamp
        ? contest.start_timestamp
        : contest.end_timestamp;
    const isUpcoming = Boolean(
      contest.start_timestamp && now < contest.start_timestamp
    );
    const isEnded = now >= contest.end_timestamp;
    const diff = Math.max(0, target - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { days, hours, mins, secs, isUpcoming, isEnded };
  };

  const cd = getCountdownParts();

  return (
    <div className="w-full px-5 pt-2 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          title="Back"
          className="w-9 h-9 rounded-full bg-white text-[#141416] flex items-center justify-center shadow-2xs active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-[#141416]">Contest & Rewards</span>
      </div>

      {/* SWITCH BETWEEN ACTIVE CONTESTS */}
      {db.contests.length > 1 && (
        <div className="w-full flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {db.contests.map((c) => {
            const active = c.id === contest?.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedContestId(c.id);
                  setAnswers({});
                }}
                className={`px-4 py-2.5 rounded-2xl text-left transition shadow-2xs shrink-0 ${
                  active
                    ? 'bg-[#141416] text-white'
                    : 'bg-white text-[#141416]'
                }`}
              >
                <div className="text-xs font-extrabold truncate max-w-[180px]">
                  {c.frontpage_config?.title || c.title}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {contest ? (
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* 1. CONTEST COUNTDOWN & HEADER */}
          <div className="w-full p-4 rounded-3xl bg-[#141416] text-white space-y-2 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-base font-extrabold text-white leading-snug">
                {contest.frontpage_config?.title || contest.title}
              </h1>
              {contest.submission_limits?.total_cap ? (
                <span className="text-xs font-bold text-[#FFEA00] shrink-0">
                  {totalSubmissionsCount}/{contest.submission_limits.total_cap} Entries
                </span>
              ) : null}
            </div>

            {cd && (
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-[#EC008C]" />
                  <span>
                    {cd.isEnded
                      ? 'Contest Ended'
                      : cd.isUpcoming
                      ? 'Starts In:'
                      : 'Time Remaining:'}
                  </span>
                </div>
                {!cd.isEnded && (
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#FFEA00]">
                    {cd.days > 0 && <span>{cd.days}d</span>}
                    <span>{String(cd.hours).padStart(2, '0')}h</span>
                    <span>{String(cd.mins).padStart(2, '0')}m</span>
                    <span className="text-[#EC008C]">
                      {String(cd.secs).padStart(2, '0')}s
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. VERTICAL SCROLL MOBILE POSTERS (FULL WIDTH EDGE-TO-EDGE, SEAMLESS CONTINUOUS STACK, NO ROUNDED CORNERS) */}
          {postersList.length > 0 && (
            <div className="-mx-5 w-[calc(100%+2.5rem)] flex flex-col p-0 rounded-none overflow-hidden">
              {postersList.map((imgUrl, idx) => (
                <img
                  key={idx}
                  src={imgUrl}
                  alt={`${contest.title} Poster ${idx + 1}`}
                  className="w-full h-auto block m-0 p-0 rounded-none select-none"
                />
              ))}
            </div>
          )}

          {/* 3. DYNAMIC CONTEST SUBMISSION QUESTIONS */}
          <div className="w-full mt-5 p-5 rounded-3xl bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#141416]">
                Submit Your Contest Entry
              </h2>
              {contest.submission_limits?.max_per_user ? (
                <span className="text-[11px] font-semibold text-zinc-500 shrink-0 whitespace-nowrap">
                  Limit: {contest.submission_limits.max_per_user} per member
                </span>
              ) : null}
            </div>

            {Number(contest.submission_limits?.points_per_submission || 0) > 0 && (
              <div className="w-full px-3.5 py-2 rounded-xl bg-[#141416] text-[#FFEA00] flex items-center justify-between text-xs font-extrabold">
                <span>Reward Points Per Entry</span>
                <span className="whitespace-nowrap">
                  +{contest.submission_limits?.points_per_submission} pts
                </span>
              </div>
            )}

            {questionsList.map((q, idx) => {
              const val = answers[q.id];
              return (
                <div key={q.id || idx} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <label className="block text-xs font-bold text-[#141416]">
                      {idx + 1}. {q.label}
                    </label>
                    {q.required !== false && (
                      <span className="text-[10px] font-bold text-[#EC008C] shrink-0">
                        Required
                      </span>
                    )}
                  </div>

                  {/* Photo Upload Question */}
                  {q.type === 'photo_upload' && (
                    <div>
                      {val ? (
                        <div className="p-3 rounded-2xl bg-[#F6F6F9] border border-zinc-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={String(val)}
                              alt="Uploaded"
                              className="w-12 h-12 rounded-xl object-cover bg-white border border-zinc-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Photo Ready
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                Tap Change to replace photo
                              </div>
                            </div>
                          </div>
                          <label className="h-8 px-3 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 inline-flex items-center cursor-pointer shrink-0">
                            <span>Change</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleUploadAnswerPhoto(q.id, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="w-full h-28 rounded-2xl border-2 border-dashed border-zinc-300 bg-[#F6F6F9] flex flex-col items-center justify-center cursor-pointer px-4 text-center active:scale-[0.99] transition">
                          {uploadingField === q.id ? (
                            <Loader2 className="w-6 h-6 text-[#EC008C] animate-spin mb-1" />
                          ) : (
                            <Camera className="w-6 h-6 text-[#EC008C] mb-1.5" />
                          )}
                          <span className="text-xs font-bold text-[#141416]">
                            {uploadingField === q.id
                              ? 'Uploading photo...'
                              : 'Tap to Snap or Upload Photo'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingField === q.id}
                            onChange={(e) => handleUploadAnswerPhoto(q.id, e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Text Question */}
                  {q.type === 'text' && (
                    <input
                      type="text"
                      placeholder="Type your answer here..."
                      value={(val as string) || ''}
                      onChange={(e) => handleSetAnswer(q.id, e.target.value)}
                      className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F6F9] text-[#141416] text-xs font-medium border border-zinc-200/80 focus:border-[#141416] focus:outline-none"
                    />
                  )}

                  {/* Range 1-10 Question */}
                  {q.type === 'range_number' && (
                    <div className="w-full grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleSetAnswer(q.id, num)}
                          className={`h-10 rounded-xl font-bold text-xs transition ${
                            val === num
                              ? 'bg-[#141416] text-[#FFEA00]'
                              : 'bg-[#F6F6F9] text-zinc-700'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Radio Select Question */}
                  {q.type === 'radio_select' && (
                    <div className="flex flex-wrap gap-2">
                      {(q.options || []).map((opt) => {
                        const isSelected = val === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSetAnswer(q.id, opt)}
                            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition border ${
                              isSelected
                                ? 'bg-[#141416] text-[#FFEA00] border-[#141416]'
                                : 'bg-[#F6F6F9] text-[#141416] border-zinc-200'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Multi Select Question */}
                  {q.type === 'multi_select' && (
                    <div className="flex flex-wrap gap-2">
                      {(q.options || []).map((opt) => {
                        const arr = Array.isArray(val) ? val : [];
                        const isSelected = arr.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? arr.filter((x: string) => x !== opt)
                                : [...arr, opt];
                              handleSetAnswer(q.id, next);
                            }}
                            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition border ${
                              isSelected
                                ? 'bg-[#141416] text-[#FFEA00] border-[#141416]'
                                : 'bg-[#F6F6F9] text-[#141416] border-zinc-200'
                            }`}
                          >
                            {isSelected && '✓ '}
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={Boolean(cd?.isEnded)}
              className="w-full h-12 rounded-full bg-[#EC008C] text-white font-bold text-xs shadow-md disabled:opacity-50"
            >
              {cd?.isEnded
                ? 'Contest Has Ended'
                : Number(contest.submission_limits?.points_per_submission || 0) >
                  0
                ? `Submit Contest Entry (+${contest.submission_limits?.points_per_submission} pts)`
                : 'Submit Contest Entry'}
            </button>
          </div>
        </form>
      ) : (
        <div className="w-full p-6 rounded-3xl bg-white text-center text-xs text-zinc-400">
          No active contest right now.
        </div>
      )}

      {/* REWARDS TO CLAIM */}
      {db.rewards.length > 0 && (
        <div className="w-full space-y-2.5">
          <h2 className="text-base font-bold text-[#141416]">My Contest Rewards</h2>
          {db.rewards.map((rew) => (
            <div
              key={rew.id}
              className="w-full p-4 rounded-3xl bg-[#141416] text-white space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FFEA00] text-[#141416] flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-[#FFEA00] font-semibold">
                    {rew.contest_title} • {rew.worth_label}
                  </div>
                  <div className="text-sm font-bold text-white">
                    {rew.reward_name}
                  </div>
                </div>
              </div>

              {rew.claimed ? (
                <div className="text-xs font-semibold text-emerald-400">
                  Claimed via{' '}
                  {rew.claim_method === 'delivery'
                    ? `Delivery (+$${db.settings.delivery_fee})`
                    : 'Self-Collect (Free)'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setClaimDeliveryMode('collect')}
                      className={`h-9 rounded-full font-semibold transition ${
                        claimDeliveryMode === 'collect'
                          ? 'bg-[#FFEA00] text-[#141416]'
                          : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      Self-Collect (Free)
                    </button>
                    <button
                      type="button"
                      onClick={() => setClaimDeliveryMode('delivery')}
                      className={`h-9 rounded-full font-semibold transition ${
                        claimDeliveryMode === 'delivery'
                          ? 'bg-[#FFEA00] text-[#141416]'
                          : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      Delivery (+${db.settings.delivery_fee})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => claimReward(rew.id, claimDeliveryMode)}
                    className="w-full h-10 rounded-full bg-[#EC008C] text-white font-bold text-xs"
                  >
                    Claim Reward
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
