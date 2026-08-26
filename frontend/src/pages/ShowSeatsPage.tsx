import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Clock,
  Monitor,
  MapPin,
  Zap,
  ShoppingCart,
  X,
  AlertCircle,
  RefreshCw,
  Users,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import api from '../lib/api';
import socket from '../lib/socket';
import useAuthStore from '../store/authStore';
import { CategoryStat, Seat, Show, WaitlistEntry } from '../types';

export default function ShowSeatsPage() {
  const { id: showId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const claimOfferParam = searchParams.get('claimOffer');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const sessionId = useRef<string>('sess-' + Math.random().toString(36).slice(2));

  const [show, setShow] = useState<Show | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<boolean>(false);
  const [holdExpiry, setHoldExpiry] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [myOffers, setMyOffers] = useState<WaitlistEntry[]>([]);
  const [joiningWaitlist, setJoiningWaitlist] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!showId) return;
    setLoading(true);
    setError(null);
    try {
      const data: any = await api.get('/shows/' + showId + '/seats');
      setShow(data);
      setSeats(Array.isArray(data?.screen?.seats) ? data.screen.seats : []);
      setCategoryStats(Array.isArray(data?.categoryStats) ? data.categoryStats : []);
    } catch (e: any) {
      const msg = e?.detail || e?.error || e?.message || 'Failed to load seats';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [showId]);

  const loadUserOffers = useCallback(async () => {
    if (!user || !showId) return;
    try {
      const waitlists: WaitlistEntry[] = (await api.get('/waitlist/my')) as any;
      const activeForShow = waitlists.filter(
        (w) => w.showId === showId && w.status === 'OFFER_PENDING' && !w.isOfferExpired
      );
      setMyOffers(activeForShow);
    } catch (err) {
      console.error('Failed to load waitlist offers:', err);
    }
  }, [showId, user]);

  useEffect(() => {
    if (!showId) return;
    load();
    loadUserOffers();
    socket.connect(showId);

    const onHeld = ({ seatIds, sessionId: sid, expiresAt }: any) => {
      if (sid === sessionId.current) return;
      setSeats((p) => p.map((s) => (seatIds.includes(s.id) ? { ...s, status: 'HELD' } : s)));
    };
    const onBooked = ({ seatIds }: any) => {
      setSeats((p) => p.map((s) => (seatIds.includes(s.id) ? { ...s, status: 'BOOKED' } : s)));
      setSelected((p) => p.filter((id) => !seatIds.includes(id)));
      loadUserOffers();
    };
    const onRelease = ({ seatIds }: any) =>
      setSeats((p) => p.map((s) => (seatIds?.includes(s.id) ? { ...s, status: 'AVAILABLE' } : s)));
    const onExpire = ({ seatIds }: any) =>
      setSeats((p) => p.map((s) => (seatIds.includes(s.id) ? { ...s, status: 'AVAILABLE' } : s)));
    const onWaitlistOffer = (payload: any) => {
      if (payload.showId === showId) {
        loadUserOffers();
      }
    };

    socket.on('seats:held', onHeld);
    socket.on('seats:booked', onBooked);
    socket.on('seats:released', onRelease);
    socket.on('seats:holdExpired', onExpire);
    socket.on('waitlist:offerCreated', onWaitlistOffer);

    return () => {
      socket.off('seats:held', onHeld);
      socket.off('seats:booked', onBooked);
      socket.off('seats:released', onRelease);
      socket.off('seats:holdExpired', onExpire);
      socket.off('waitlist:offerCreated', onWaitlistOffer);
      socket.disconnect();
    };
  }, [showId, load, loadUserOffers]);

  useEffect(() => {
    if (!holdExpiry) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(holdExpiry).getTime() - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        setSelected([]);
        setHoldExpiry(null);
        setTimeLeft(null);
        toast.error('Hold expired — please reselect.');
      }
    }, 1000);
    return () => clearInterval(t);
  }, [holdExpiry]);

  const toggle = (seat: Seat) => {
    if (['BOOKED', 'HELD', 'BLOCKED', 'MAINTENANCE'].includes(seat.status)) return;
    setSelected((p) => {
      if (p.includes(seat.id)) return p.filter((id) => id !== seat.id);
      if (p.length >= 8) {
        toast.error('Max 8 seats allowed per transaction');
        return p;
      }
      return [...p, seat.id];
    });
  };

  const holdSeats = async () => {
    if (!selected.length || !showId) return;
    try {
      const res: any = await api.post('/bookings/hold', {
        show_id: showId,
        seat_ids: selected,
        session_id: sessionId.current,
      });
      if (res?.expiresAt) {
        setHoldExpiry(res.expiresAt);
        toast.success('Seats held for 5 minutes!');
      }
    } catch (e: any) {
      toast.error(e?.detail || e?.error || 'Hold failed');
      setSelected([]);
      load();
    }
  };

  const confirmBooking = async () => {
    if (!selected.length || !showId) return;
    if (!localStorage.getItem('token')) {
      toast.error('Please sign in to complete your booking');
      navigate('/login?redirect=/show/' + showId + '/seats');
      return;
    }
    setBooking(true);
    try {
      const r: any = await api.post('/bookings', {
        show_id: showId,
        seat_ids: selected,
        session_id: sessionId.current,
      });
      toast.success('🎉 Booking confirmed successfully!');
      navigate('/booking/' + r.bookingRef);
    } catch (e: any) {
      toast.error(e?.detail || e?.error || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const handleJoinWaitlist = async (seatTypeId: string, categoryName: string) => {
    if (!showId) return;
    if (!localStorage.getItem('token')) {
      toast.error('Please sign in to join the waitlist');
      navigate('/login?redirect=/show/' + showId + '/seats');
      return;
    }
    setJoiningWaitlist(seatTypeId);
    try {
      const res: any = await api.post('/waitlist/join', { show_id: showId, seat_type_id: seatTypeId });
      toast.success(`You are #${res.queuePosition} in the waitlist for ${categoryName}!`);
      loadUserOffers();
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to join waitlist');
    } finally {
      setJoiningWaitlist(null);
    }
  };

  const handleClaimOffer = async (waitlistId: string) => {
    try {
      setBooking(true);
      const res: any = await api.post(`/waitlist/${waitlistId}/claim`);
      toast.success('🎉 Waitlist offer claimed successfully!');
      navigate(`/booking/${res.booking.bookingRef}`);
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to claim waitlist offer');
    } finally {
      setBooking(false);
    }
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-gray-700 border-t-rose-500 animate-spin" />
        <p className="text-gray-400">Loading seat layout…</p>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <AlertCircle size={48} className="text-red-400" />
        <p className="text-lg font-semibold">Could not load seats</p>
        <p className="text-gray-400 text-sm">{error}</p>
        <button onClick={load} className="btn-primary flex items-center gap-2">
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );

  if (!show)
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-500">Show not found</div>;

  const maxRow = seats.length ? Math.max(...seats.map((s) => s.row)) : -1;
  const maxCol = seats.length ? Math.max(...seats.map((s) => s.col)) : -1;
  const byPos = new Map(seats.map((s) => [s.row + '-' + s.col, s]));

  const selectedSeats = seats.filter((s) => selected.includes(s.id));
  const total = selectedSeats.reduce((n, s) => n + (s.price || 0), 0);

  const typeMap = new Map();
  seats.forEach((s) => {
    if (s.seatType && !typeMap.has(s.seatType.id)) typeMap.set(s.seatType.id, s.seatType);
  });
  const seatTypes = [...typeMap.values()];

  const dominant: { [row: number]: string } = {};
  for (let r = 0; r <= maxRow; r++) {
    const rs = seats.filter((s) => s.row === r);
    if (!rs.length) continue;
    const cnt: { [name: string]: number } = {};
    rs.forEach((s) => {
      const name = s.seatType?.name || 'Standard';
      cnt[name] = (cnt[name] || 0) + 1;
    });
    dominant[r] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  }
  const breaks: { [row: number]: string } = {};
  let last: string | null = null;
  for (let r = 0; r <= maxRow; r++) {
    if (dominant[r] && dominant[r] !== last) {
      breaks[r] = dominant[r];
      last = dominant[r];
    }
  }

  const soldOutCategories = categoryStats.filter((c) => c.isSoldOut);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-36">
      <div className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold mb-1">{show.movie?.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <Clock size={13} />
                {format(new Date(show.startTime), 'h:mm a, EEE d MMM')}
              </span>
              <span className="flex items-center gap-1.5">
                <Monitor size={13} />
                {show.screen?.name}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {show.screen?.theatre?.name}
              </span>
            </div>
          </div>
          {holdExpiry && timeLeft != null && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono font-bold ${
                timeLeft < 60
                  ? 'bg-red-900/60 text-red-300 animate-pulse'
                  : 'bg-amber-900/50 text-amber-300'
              }`}
            >
              <Zap size={13} />
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} left
            </div>
          )}
        </div>
      </div>

      {myOffers.map((offer) => (
        <div
          key={offer.id}
          className="mb-6 bg-gradient-to-r from-purple-950 via-gray-900 to-rose-950 border-2 border-purple-500/80 rounded-2xl p-5 shadow-2xl shadow-purple-950/40"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles size={13} /> Exclusive Waitlist Offer
              </div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                A seat opened up for you! Seat:{' '}
                <span className="font-mono text-amber-300">
                  {offer.offeredSeat?.label || 'Reserved'}
                </span>
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Category: <span className="font-semibold text-purple-300">{offer.seatType?.name}</span> ·
                Offer expires at{' '}
                {offer.offerExpiresAt ? new Date(offer.offerExpiresAt).toLocaleTimeString() : 'soon'}
              </p>
            </div>
            <button
              onClick={() => handleClaimOffer(offer.id)}
              disabled={booking}
              className="btn-primary bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg flex items-center gap-2 shrink-0"
            >
              <CheckCircle2 size={18} />
              {booking ? 'Claiming...' : 'Claim Ticket Now'}
            </button>
          </div>
        </div>
      ))}

      <div className="text-center mb-10">
        <div
          className="inline-block h-2 rounded-full mb-2"
          style={{ width: 'min(60vw,360px)', background: 'linear-gradient(to bottom,#d1d5db,#6b7280)' }}
        />
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.35em]">Screen / Stage</p>
      </div>

      {seats.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Monitor size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-semibold">No seat layout configured yet.</p>
          <p className="text-sm mt-1 text-gray-600">Admin needs to build the layout first.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto pb-2">
            <div className="inline-block">
              {Array.from({ length: maxRow + 1 }, (_, r) => {
                const rowSeats = seats.filter((s) => s.row === r);
                if (!rowSeats.length) return null;
                const rowLabel = rowSeats[0].rowLabel || String.fromCharCode(65 + r);
                const secName = breaks[r];
                const secType = seatTypes.find((t) => t.name === secName);

                return (
                  <div key={r}>
                    {secName && (
                      <div className="flex items-center gap-3 my-4 px-8">
                        <div
                          className="h-px flex-1"
                          style={{ backgroundColor: (secType?.color || '#4b5563') + '66' }}
                        />
                        <span
                          className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap"
                          style={{
                            backgroundColor: (secType?.color || '#4b5563') + '22',
                            color: secType?.color || '#9ca3af',
                            border: `1px solid ${secType?.color || '#4b5563'}55`,
                          }}
                        >
                          {secName}
                        </span>
                        <div
                          className="h-px flex-1"
                          style={{ backgroundColor: (secType?.color || '#4b5563') + '66' }}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-1 mb-[3px]">
                      <span className="w-7 text-[11px] text-gray-500 text-right shrink-0 font-mono">
                        {rowLabel}
                      </span>
                      <div className="flex gap-[3px] mx-1">
                        {Array.from({ length: maxCol + 1 }, (_, c) => {
                          const seat = byPos.get(r + '-' + c);
                          if (!seat) return <div key={c} className="w-8 h-8 shrink-0" />;

                          const isSel = selected.includes(seat.id);
                          const isBestView = seat.isGolden && seat.customPrice;
                          const color = seat.seatType?.color || '#6b7280';

                          let bg = color;
                          let op = 1;
                          let cur = 'pointer';
                          let outline = 'none';
                          let outOff = '0px';

                          if (isSel) {
                            bg = '#e11d48';
                            outline = '2px solid #fb7185';
                            outOff = '-1px';
                          } else if (seat.status === 'BOOKED') {
                            bg = '#3f0000';
                            op = 0.5;
                            cur = 'not-allowed';
                          } else if (seat.status === 'HELD') {
                            bg = '#451a03';
                            op = 0.6;
                            cur = 'not-allowed';
                          } else if (seat.status === 'BLOCKED' || seat.status === 'MAINTENANCE') {
                            bg = '#111827';
                            op = 0.2;
                            cur = 'not-allowed';
                          } else if (isBestView) {
                            outline = '2px solid #f59e0b';
                            outOff = '-1px';
                          } else if (seat.isGolden) {
                            outline = '1px solid #fbbf24';
                            outOff = '-1px';
                          }

                          return (
                            <button
                              key={c}
                              onClick={() => toggle(seat)}
                              disabled={['BOOKED', 'HELD', 'BLOCKED', 'MAINTENANCE'].includes(seat.status)}
                              title={`${seat.label} · ${seat.seatType?.name || 'Seat'}${
                                isBestView ? ' · 💰 Best View' : seat.isGolden ? ' · ⭐' : ''
                              } · ₹${seat.price}`}
                              className="w-8 h-8 shrink-0 rounded-t-md flex items-center justify-center transition-all duration-75"
                              style={{
                                backgroundColor: bg,
                                opacity: op,
                                cursor: cur,
                                outline,
                                outlineOffset: outOff,
                              }}
                            >
                              {isBestView ? (
                                <span style={{ fontSize: '9px', lineHeight: 1 }} className="text-yellow-300">
                                  💰
                                </span>
                              ) : seat.isGolden ? (
                                <span style={{ fontSize: '9px', lineHeight: 1 }} className="text-yellow-300">
                                  ★
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      <span className="w-7 text-[11px] text-gray-500 text-left shrink-0 font-mono">
                        {rowLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-8 mb-4 text-xs text-gray-400">
            {seatTypes.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-t-sm" style={{ backgroundColor: t.color }} />
                <span>{t.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-t-sm bg-rose-600"
                style={{ outline: '2px solid #fb7185', outlineOffset: '-1px' }}
              />
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-t-sm" style={{ backgroundColor: '#3f0000', opacity: 0.5 }} />
              <span>Booked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-t-sm" style={{ backgroundColor: '#451a03', opacity: 0.6 }} />
              <span>Held</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-t-sm bg-gray-600"
                style={{ outline: '2px solid #f59e0b', outlineOffset: '-1px' }}
              />
              <span>💰 Best View</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-4 mb-6">
            {seatTypes.map((t) => {
              const sample = seats.find((s) => s.seatType?.id === t.id && s.status === 'AVAILABLE');
              if (!sample) return null;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-2 bg-gray-800/80 rounded-lg px-3 py-1.5 text-sm border border-gray-700"
                >
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.color }} />
                  <span className="text-gray-300">{t.name}</span>
                  <span className="font-bold text-white">₹{sample.price}</span>
                </div>
              );
            })}
          </div>

          {soldOutCategories.length > 0 && (
            <div className="mt-8 mb-6 p-5 bg-gray-900 border border-purple-500/30 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} className="text-purple-400" />
                <h3 className="font-bold text-sm text-gray-200">Category Sold Out? Join the FIFO Waitlist</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                When tickets are cancelled in sold-out categories, seats are automatically offered to
                waitlisted customers in strict first-come, first-served order with a 15-minute claim window.
              </p>
              <div className="flex flex-wrap gap-3">
                {soldOutCategories.map((cat) => (
                  <button
                    key={cat.seatTypeId}
                    onClick={() => handleJoinWaitlist(cat.seatTypeId, cat.seatTypeName)}
                    disabled={joiningWaitlist === cat.seatTypeId}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/50 hover:border-purple-400 text-purple-200 text-xs font-semibold rounded-xl transition-all shadow-sm"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    Join {cat.seatTypeName} Waitlist
                    {joiningWaitlist === cat.seatTypeId && '...'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-400">
                {selected.length} seat{selected.length > 1 ? 's' : ''}:{' '}
                <span className="text-white font-mono font-semibold">
                  {selectedSeats.map((s) => s.label).join(', ')}
                </span>
              </p>
              <p className="text-2xl font-bold">₹{total.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected([])} className="btn-secondary flex items-center gap-1 text-sm">
                <X size={15} /> Clear
              </button>
              {!holdExpiry && (
                <button onClick={holdSeats} className="btn-secondary flex items-center gap-1 text-sm">
                  <Zap size={15} /> Hold 5 min
                </button>
              )}
              <button
                onClick={confirmBooking}
                disabled={booking}
                className="btn-primary flex items-center gap-2 px-5"
              >
                <ShoppingCart size={15} />
                {booking ? 'Booking…' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
