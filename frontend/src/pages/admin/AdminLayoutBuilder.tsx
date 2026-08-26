import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Save, RotateCcw, Info, DollarSign, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Screen, SeatType } from '../../types';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function seatStyle(hexColor: string, opacity: number = 1) {
  return { backgroundColor: hexColor, opacity };
}

interface GridCell {
  seatTypeId?: string;
  seatTypeName?: string;
  seatColor?: string;
  isGolden?: boolean;
  isAccessible?: boolean;
  isBlocked?: boolean;
  customPrice?: number | null;
}

export default function AdminLayoutBuilder() {
  const { screenId } = useParams<{ screenId: string }>();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [seatTypes, setSeatTypes] = useState<SeatType[]>([]);
  const [grid, setGrid] = useState<{ [key: string]: GridCell }>({});
  const [activeTool, setActiveTool] = useState<string>('place');
  const [activeSeatType, setActiveSeatType] = useState<SeatType | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Modals
  const [showPricing, setShowPricing] = useState<boolean>(false);
  const [showBestViewModal, setShowBestViewModal] = useState<boolean>(false);
  const [bestViewTarget, setBestViewTarget] = useState<{ r: number; c: number; key: string } | null>(null);

  const [pricing, setPricing] = useState<{ [seatTypeId: string]: any }>({});

  const loadData = useCallback(() => {
    if (!screenId) return;
    api.get(`/screens/${screenId}`).then((data: any) => {
      setScreen(data);
      const g: { [key: string]: GridCell } = {};
      data.seats?.forEach((seat: any) => {
        g[`${seat.row}-${seat.col}`] = {
          seatTypeId: seat.seatTypeId,
          seatTypeName: seat.seatType?.name,
          seatColor: seat.seatType?.color || '#6b7280',
          isGolden: seat.isGolden,
          isAccessible: seat.isAccessible,
          isBlocked: seat.status === 'BLOCKED',
          customPrice: seat.customPrice || null,
        };
      });
      setGrid(g);
    });
    api.get('/screens/' + screenId + '/pricing').then((data: any) => {
      const p: any = {};
      data.forEach((d: any) => {
        p[d.seatTypeId || d.seat_type_id] = d;
      });
      setPricing(p);
    });
  }, [screenId]);

  useEffect(() => {
    loadData();
    setSeatTypes([
      { id: '1', name: 'Royal', color: '#9333ea', description: 'VIP recliner seating' },
      { id: '2', name: 'Balcony', color: '#f59e0b', description: 'Panoramic viewing deck' },
      { id: '3', name: 'First Class', color: '#10b981', description: 'Prime central sound field' },
      { id: '4', name: 'Standard', color: '#6b7280', description: 'Comfortable auditorium seating' },
    ]);
    setActiveSeatType({ id: '1', name: 'Royal', color: '#9333ea' });
  }, [loadData]);

  const applyTool = useCallback(
    (r: number, c: number) => {
      const key = `${r}-${c}`;
      if (activeTool === 'bestview') {
        setGrid((prev) => {
          if (!prev[key]) return prev;
          setBestViewTarget({ r, c, key });
          setShowBestViewModal(true);
          return prev;
        });
        return;
      }
      setGrid((prev) => {
        const next = { ...prev };
        if (activeTool === 'erase') {
          delete next[key];
        } else if (activeTool === 'place' && activeSeatType) {
          next[key] = {
            seatTypeId: activeSeatType.id,
            seatTypeName: activeSeatType.name,
            seatColor: activeSeatType.color,
            isGolden: false,
            isAccessible: false,
            isBlocked: false,
            customPrice: null,
          };
        } else if (activeTool === 'golden' && next[key]) {
          next[key] = { ...next[key], isGolden: !next[key].isGolden };
        } else if (activeTool === 'accessible' && next[key]) {
          next[key] = { ...next[key], isAccessible: !next[key].isAccessible };
        } else if (activeTool === 'blocked' && next[key]) {
          next[key] = { ...next[key], isBlocked: !next[key].isBlocked };
        }
        return next;
      });
    },
    [activeTool, activeSeatType]
  );

  const handleMouseDown = (r: number, c: number) => {
    setIsDragging(true);
    applyTool(r, c);
  };
  const handleMouseEnter = (r: number, c: number) => {
    if (isDragging && activeTool !== 'bestview') applyTool(r, c);
  };
  const handleMouseUp = () => setIsDragging(false);

  const saveLayout = async () => {
    if (!screen) return;
    setSaving(true);
    try {
      const seats = [];
      for (let r = 0; r < screen.rows; r++) {
        let colCounter = 1;
        for (let c = 0; c < screen.cols; c++) {
          const cell = grid[`${r}-${c}`];
          if (cell) {
            const rowLabel = ROW_LABELS[r] || `R${r}`;
            seats.push({
              row: r,
              col: c,
              label: `${rowLabel}${colCounter}`,
              row_label: rowLabel,
              seat_type_id: cell.seatTypeId,
              is_golden: cell.isGolden || false,
              is_accessible: cell.isAccessible || false,
              status: cell.isBlocked ? 'BLOCKED' : 'ACTIVE',
              custom_price: cell.customPrice ? parseFloat(cell.customPrice as any) : null,
            });
            colCounter++;
          }
        }
      }
      await api.post(`/screens/${screenId}/layout`, { rows: screen.rows, cols: screen.cols, seats });
      toast.success(`Layout saved — ${seats.length} seats`);
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const savePricing = async () => {
    try {
      const pricingList = Object.entries(pricing).map(([seatTypeId, p]: any) => ({
        seat_type_id: seatTypeId,
        base_price: parseFloat(p.basePrice || p.base_price) || 0,
        weekend_price: parseFloat(p.weekendPrice || p.weekend_price) || null,
        peak_price: parseFloat(p.peakPrice || p.peak_price) || null,
      }));
      await api.post(`/screens/${screenId}/pricing`, { pricing: pricingList });
      toast.success('Pricing saved');
      setShowPricing(false);
    } catch (err: any) {
      toast.error(err?.detail || err?.error || 'Failed to save pricing');
    }
  };

  const fillRow = (r: number) => {
    if (!activeSeatType || activeTool !== 'place') return;
    setGrid((prev) => {
      const next = { ...prev };
      for (let c = 0; c < (screen?.cols || 15); c++) {
        next[`${r}-${c}`] = {
          seatTypeId: activeSeatType.id,
          seatTypeName: activeSeatType.name,
          seatColor: activeSeatType.color,
          isGolden: false,
          isAccessible: false,
          isBlocked: false,
          customPrice: null,
        };
      }
      return next;
    });
  };

  const clearAll = () => {
    if (confirm('Clear all seats?')) setGrid({});
  };

  if (!screen) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  const seatCount = Object.keys(grid).length;
  const bestViewCount = Object.values(grid).filter((c) => c.customPrice).length;

  return (
    <div onMouseUp={handleMouseUp} className="select-none">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/admin/theatres" className="hover:text-white">
          Venues
        </Link>
        <span>/</span>
        <Link to={`/admin/theatres/${screen.theatreId}/screens`} className="hover:text-white">
          Screens
        </Link>
        <span>/</span>
        <span className="text-white">{screen.name} — Layout</span>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Layout Builder — {screen.name}</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowPricing(true)} className="btn-secondary flex items-center gap-1 text-sm">
            <DollarSign size={14} /> Pricing
          </button>
          <button onClick={clearAll} className="btn-secondary flex items-center gap-1 text-sm">
            <RotateCcw size={14} /> Clear
          </button>
          <button
            onClick={saveLayout}
            disabled={saving}
            className="btn-primary flex items-center gap-1 text-sm"
          >
            <Save size={14} /> {saving ? 'Saving...' : `Save (${seatCount} seats)`}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="w-52 shrink-0 space-y-3">
          <div className="card p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Paint Seat Category</div>
            <div className="space-y-1">
              {seatTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setActiveSeatType(type);
                    setActiveTool('place');
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-all border ${
                    activeSeatType?.id === type.id && activeTool === 'place'
                      ? 'ring-2 ring-white/40 border-white/20'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: type.color + '33',
                    borderColor:
                      activeSeatType?.id === type.id && activeTool === 'place' ? type.color : 'transparent',
                  }}
                >
                  <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: type.color }} />
                  <span className="truncate text-white">{type.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tools</div>
            <div className="space-y-1">
              {[
                { id: 'erase', label: '🗑 Erase / Aisle' },
                { id: 'golden', label: '⭐ Best View Toggle' },
                { id: 'bestview', label: '💰 Set Best View Price' },
                { id: 'accessible', label: '♿ Accessible' },
                { id: 'blocked', label: '🚫 Block Seat' },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    activeTool === tool.id
                      ? 'bg-rose-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-3 text-sm">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Stats</div>
            <div className="space-y-1 text-gray-300">
              <div>
                Total: <span className="font-bold text-white">{seatCount}</span>
              </div>
              <div>
                Best View: <span className="font-bold text-yellow-400">{bestViewCount}</span>
              </div>
              <div>
                Grid: <span className="font-bold text-white">{screen.rows}×{screen.cols}</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 flex items-start gap-1">
            <Info size={12} className="mt-0.5 shrink-0" />
            Click row label to fill entire row. Drag to paint multiple seats.
          </div>
        </div>

        <div className="flex-1 overflow-auto seat-grid pb-4">
          <div className="text-center mb-4">
            <div className="inline-block bg-gradient-to-b from-gray-300 to-gray-500 h-1.5 w-48 rounded-full" />
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Screen</div>
          </div>

          <div className="inline-block">
            {Array.from({ length: screen.rows }, (_, r) => (
              <div key={r} className="flex items-center gap-0.5 mb-0.5">
                <button
                  onClick={() => fillRow(r)}
                  className="w-6 text-xs text-gray-500 hover:text-rose-400 text-right shrink-0 transition-colors font-mono"
                  title="Click to fill entire row"
                >
                  {ROW_LABELS[r] || r}
                </button>
                <div className="flex gap-0.5 ml-1">
                  {Array.from({ length: screen.cols }, (_, c) => {
                    const cell = grid[`${r}-${c}`];
                    const hasBestView = cell?.customPrice;
                    const isGolden = cell?.isGolden;
                    return (
                      <div
                        key={c}
                        onMouseDown={() => handleMouseDown(r, c)}
                        onMouseEnter={() => handleMouseEnter(r, c)}
                        title={
                          cell
                            ? `${ROW_LABELS[r]}${c + 1} — ${cell.seatTypeName}${isGolden ? ' ⭐' : ''}${
                                hasBestView ? ` 💰₹${cell.customPrice}` : ''
                              }${cell.isAccessible ? ' ♿' : ''}${cell.isBlocked ? ' 🚫' : ''}`
                            : `Empty (${ROW_LABELS[r]}${c + 1})`
                        }
                        className={`w-6 h-6 rounded-t cursor-pointer transition-all text-xs flex items-center justify-center relative ${
                          cell ? '' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                        } ${cell?.isBlocked ? 'opacity-30' : ''}`}
                        style={
                          cell
                            ? {
                                ...seatStyle(cell.seatColor || '#6b7280'),
                                outline: hasBestView ? '2px solid #f59e0b' : isGolden ? '1px solid #fbbf24' : 'none',
                                outlineOffset: '-1px',
                              }
                            : {}
                        }
                      >
                        {hasBestView ? (
                          <span className="text-yellow-300" style={{ fontSize: '8px' }}>
                            💰
                          </span>
                        ) : isGolden ? (
                          <span className="text-yellow-300" style={{ fontSize: '8px' }}>
                            ★
                          </span>
                        ) : cell?.isAccessible ? (
                          <span className="text-blue-300" style={{ fontSize: '8px' }}>
                            ♿
                          </span>
                        ) : cell?.isBlocked ? (
                          <span className="text-red-400" style={{ fontSize: '8px' }}>
                            ×
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-6 text-xs text-gray-400">
            {seatTypes.map((type) => (
              <div key={type.id} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-t" style={{ backgroundColor: type.color }} />
                <span>{type.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-t bg-gray-800 border border-gray-700" />
              <span>Empty / Aisle</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-t bg-gray-600"
                style={{ outline: '2px solid #f59e0b', outlineOffset: '-1px' }}
              />
              <span>💰 Best View (custom price)</span>
            </div>
          </div>
        </div>
      </div>

      {showBestViewModal && bestViewTarget && (
        <BestViewModal
          cell={grid[bestViewTarget.key]}
          rowLabel={ROW_LABELS[bestViewTarget.r]}
          col={bestViewTarget.c}
          onSave={(price: number | null) => {
            setGrid((prev) => ({
              ...prev,
              [bestViewTarget.key]: {
                ...prev[bestViewTarget.key],
                customPrice: price || null,
                isGolden: price ? true : prev[bestViewTarget.key].isGolden,
              },
            }));
            setShowBestViewModal(false);
            setBestViewTarget(null);
          }}
          onClose={() => {
            setShowBestViewModal(false);
            setBestViewTarget(null);
          }}
        />
      )}

      {showPricing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold">Screen Pricing — {screen.name}</h2>
              <button onClick={() => setShowPricing(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-gray-500">
                Set base pricing per seat type. Individual 'Best View' seats can override this with a custom price.
              </p>
              {seatTypes.map((type) => (
                <div key={type.id} className="card p-3">
                  <div className="font-semibold mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: type.color }} />
                    {type.name}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'basePrice', label: 'Base ₹' },
                      { key: 'weekendPrice', label: 'Weekend ₹' },
                      { key: 'peakPrice', label: 'Peak ₹' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="label text-xs">{label}</label>
                        <input
                          type="number"
                          className="input text-sm"
                          placeholder="0"
                          value={pricing[type.id]?.[key] || ''}
                          onChange={(e) =>
                            setPricing((prev) => ({
                              ...prev,
                              [type.id]: { ...(prev[type.id] || {}), [key]: e.target.value },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-3">
                <button onClick={() => setShowPricing(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={savePricing} className="btn-primary flex-1">
                  Save Pricing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BestViewModal({ cell, rowLabel, col, onSave, onClose }: any) {
  const [price, setPrice] = useState(cell?.customPrice || '');
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-bold">💰 Best View Price</h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
            <div
              className="w-8 h-8 rounded-t flex items-center justify-center text-yellow-300"
              style={{ backgroundColor: cell?.seatColor }}
            >
              ★
            </div>
            <div>
              <div className="font-semibold">
                Seat {rowLabel}
                {col + 1}
              </div>
              <div className="text-xs text-gray-400">{cell?.seatTypeName}</div>
            </div>
          </div>
          <div>
            <label className="label">Custom Price (₹) — overrides base pricing</label>
            <input
              type="number"
              className="input"
              placeholder="e.g. 750"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to remove custom price and use base pricing.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={() => onSave(price ? parseFloat(price) : null)} className="btn-primary flex-1">
              {price ? `Set ₹${price}` : 'Remove Custom Price'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
