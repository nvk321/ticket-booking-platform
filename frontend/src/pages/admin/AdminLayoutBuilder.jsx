import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Save, RotateCcw, Info, DollarSign, X, Plus, Edit2, Trash2, Tag } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Convert hex color to tailwind-compatible inline style
function seatStyle(hexColor, opacity = 1) {
  return { backgroundColor: hexColor, opacity };
}

export default function AdminLayoutBuilder() {
  const { screenId } = useParams();
  const [screen, setScreen] = useState(null);
  const [seatTypes, setSeatTypes] = useState([]);
  // grid: key "r-c" => { seatTypeId, seatTypeName, seatColor, isGolden, isAccessible, isBlocked, customPrice }
  const [grid, setGrid] = useState({});
  const [activeTool, setActiveTool] = useState("place");
  const [activeSeatType, setActiveSeatType] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showPricing, setShowPricing] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [showBestViewModal, setShowBestViewModal] = useState(false);
  const [bestViewTarget, setBestViewTarget] = useState(null); // { r, c }

  const [pricing, setPricing] = useState({});

  // Seat type manager state
  const [typeForm, setTypeForm] = useState({ name: "", color: "#6b7280", description: "" });
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [savingType, setSavingType] = useState(false);

  const loadData = useCallback(() => {
    api.get(`/screens/${screenId}`).then(data => {
      setScreen(data);
      const g = {};
      data.seats?.forEach(seat => {
        g[`${seat.row}-${seat.col}`] = {
          seatTypeId: seat.seatTypeId,
          seatTypeName: seat.seatType?.name,
          seatColor: seat.seatType?.color || "#6b7280",
          isGolden: seat.isGolden,
          isAccessible: seat.isAccessible,
          isBlocked: seat.status === "BLOCKED",
          customPrice: seat.customPrice || null,
        };
      });
      setGrid(g);
    });
    api.get("/seat-types").then(types => {
      setSeatTypes(types);
      setActiveSeatType(prev => prev ? (types.find(t => t.id === prev.id) || types[0]) : types[0]);
    });
    api.get(`/screens/${screenId}/pricing`).then(data => {
      const p = {};
      data.forEach(d => { p[d.seatTypeId] = d; });
      setPricing(p);
    });
  }, [screenId]);

  useEffect(() => { loadData(); }, [loadData]);

  const applyTool = useCallback((r, c) => {
    const key = `${r}-${c}`;
    if (activeTool === "bestview") {
      setGrid(prev => {
        if (!prev[key]) return prev;
        setBestViewTarget({ r, c, key });
        setShowBestViewModal(true);
        return prev;
      });
      return;
    }
    setGrid(prev => {
      const next = { ...prev };
      if (activeTool === "erase") {
        delete next[key];
      } else if (activeTool === "place" && activeSeatType) {
        next[key] = {
          seatTypeId: activeSeatType.id,
          seatTypeName: activeSeatType.name,
          seatColor: activeSeatType.color,
          isGolden: false,
          isAccessible: false,
          isBlocked: false,
          customPrice: null,
        };
      } else if (activeTool === "golden" && next[key]) {
        next[key] = { ...next[key], isGolden: !next[key].isGolden };
      } else if (activeTool === "accessible" && next[key]) {
        next[key] = { ...next[key], isAccessible: !next[key].isAccessible };
      } else if (activeTool === "blocked" && next[key]) {
        next[key] = { ...next[key], isBlocked: !next[key].isBlocked };
      }
      return next;
    });
  }, [activeTool, activeSeatType]);

  const handleMouseDown = (r, c) => { setIsDragging(true); applyTool(r, c); };
  const handleMouseEnter = (r, c) => { if (isDragging && activeTool !== "bestview") applyTool(r, c); };
  const handleMouseUp = () => setIsDragging(false);

  const saveLayout = async () => {
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
              row: r, col: c,
              label: `${rowLabel}${colCounter}`,
              rowLabel,
              seatTypeId: cell.seatTypeId,
              isGolden: cell.isGolden || false,
              isAccessible: cell.isAccessible || false,
              status: cell.isBlocked ? "BLOCKED" : "ACTIVE",
              customPrice: cell.customPrice ? parseFloat(cell.customPrice) : null,
            });
            colCounter++;
          }
        }
      }
      await api.post(`/screens/${screenId}/layout`, { seats });
      toast.success(`Layout saved — ${seats.length} seats`);
    } catch (err) {
      toast.error(err.error || "Failed to save layout");
    } finally {
      setSaving(false);
    }
  };

  const savePricing = async () => {
    try {
      const pricingList = Object.entries(pricing).map(([seatTypeId, p]) => ({
        seatTypeId,
        basePrice: parseFloat(p.basePrice) || 0,
        weekendPrice: parseFloat(p.weekendPrice) || null,
        peakPrice: parseFloat(p.peakPrice) || null,
      }));
      await api.post(`/screens/${screenId}/pricing`, { pricingList });
      toast.success("Pricing saved");
      setShowPricing(false);
    } catch (err) {
      toast.error(err.error || "Failed to save pricing");
    }
  };

  const fillRow = (r) => {
    if (!activeSeatType || activeTool !== "place") return;
    setGrid(prev => {
      const next = { ...prev };
      for (let c = 0; c < (screen?.cols || 15); c++) {
        next[`${r}-${c}`] = {
          seatTypeId: activeSeatType.id,
          seatTypeName: activeSeatType.name,
          seatColor: activeSeatType.color,
          isGolden: false, isAccessible: false, isBlocked: false, customPrice: null,
        };
      }
      return next;
    });
  };

  const clearAll = () => { if (confirm("Clear all seats?")) setGrid({}); };

  // Seat type manager
  const openCreateType = () => { setEditingTypeId(null); setTypeForm({ name: "", color: "#6b7280", description: "" }); };
  const openEditType = (t) => { setEditingTypeId(t.id); setTypeForm({ name: t.name, color: t.color, description: t.description || "" }); };

  const saveType = async (e) => {
    e.preventDefault();
    setSavingType(true);
    try {
      if (editingTypeId) {
        await api.put(`/seat-types/${editingTypeId}`, typeForm);
        toast.success("Seat type updated");
      } else {
        await api.post("/seat-types", typeForm);
        toast.success("Seat type created");
      }
      setEditingTypeId(null);
      setTypeForm({ name: "", color: "#6b7280", description: "" });
      loadData();
    } catch (err) {
      toast.error(err.error || "Failed to save");
    } finally {
      setSavingType(false);
    }
  };

  const deleteType = async (id) => {
    if (!confirm("Delete this seat type?")) return;
    try {
      await api.delete(`/seat-types/${id}`);
      toast.success("Deleted");
      loadData();
    } catch (err) {
      toast.error(err.error || "Cannot delete");
    }
  };

  if (!screen) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
    </div>
  );

  const seatCount = Object.keys(grid).length;
  const bestViewCount = Object.values(grid).filter(c => c.customPrice).length;

  return (
    <div onMouseUp={handleMouseUp} className="select-none">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/admin/theatres" className="hover:text-white">Theatres</Link>
        <span>/</span>
        <Link to={`/admin/theatres/${screen.theatreId}/screens`} className="hover:text-white">Screens</Link>
        <span>/</span>
        <span className="text-white">{screen.name} — Layout</span>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Layout Builder — {screen.name}</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowTypeManager(true)} className="btn-secondary flex items-center gap-1 text-sm">
            <Tag size={14} /> Seat Types
          </button>
          <button onClick={() => setShowPricing(true)} className="btn-secondary flex items-center gap-1 text-sm">
            <DollarSign size={14} /> Pricing
          </button>
          <button onClick={clearAll} className="btn-secondary flex items-center gap-1 text-sm">
            <RotateCcw size={14} /> Clear
          </button>
          <button onClick={saveLayout} disabled={saving} className="btn-primary flex items-center gap-1 text-sm">
            <Save size={14} /> {saving ? "Saving..." : `Save (${seatCount} seats)`}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Toolbar */}
        <div className="w-52 shrink-0 space-y-3">
          {/* Seat Types */}
          <div className="card p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Paint Seat Type</div>
            <div className="space-y-1">
              {seatTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => { setActiveSeatType(type); setActiveTool("place"); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-all border ${
                    activeSeatType?.id === type.id && activeTool === "place"
                      ? "ring-2 ring-white/40 border-white/20"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: type.color + "33", borderColor: activeSeatType?.id === type.id && activeTool === "place" ? type.color : "transparent" }}
                >
                  <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: type.color }} />
                  <span className="truncate text-white">{type.name}</span>
                </button>
              ))}
              {seatTypes.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No seat types yet.<br/>Click "Seat Types" to add.</p>
              )}
            </div>
          </div>

          {/* Tools */}
          <div className="card p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tools</div>
            <div className="space-y-1">
              {[
                { id: "erase", label: "🗑 Erase / Aisle" },
                { id: "golden", label: "⭐ Best View Toggle" },
                { id: "bestview", label: "💰 Set Best View Price" },
                { id: "accessible", label: "♿ Accessible" },
                { id: "blocked", label: "🚫 Block Seat" },
              ].map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    activeTool === tool.id ? "bg-rose-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="card p-3 text-sm">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Stats</div>
            <div className="space-y-1 text-gray-300">
              <div>Total: <span className="font-bold text-white">{seatCount}</span></div>
              <div>Best View: <span className="font-bold text-yellow-400">{bestViewCount}</span></div>
              <div>Grid: <span className="font-bold text-white">{screen.rows}×{screen.cols}</span></div>
              {seatTypes.map(type => {
                const count = Object.values(grid).filter(c => c.seatTypeId === type.id).length;
                return count > 0 ? (
                  <div key={type.id} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
                    <span>{type.name}: <span className="font-bold text-white">{count}</span></span>
                  </div>
                ) : null;
              })}
            </div>
          </div>

          <div className="text-xs text-gray-500 flex items-start gap-1">
            <Info size={12} className="mt-0.5 shrink-0" />
            Click row label to fill entire row. Drag to paint multiple seats.
          </div>
        </div>

        {/* Grid */}
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
                            ? `${ROW_LABELS[r]}${c + 1} — ${cell.seatTypeName}${isGolden ? " ⭐" : ""}${hasBestView ? ` 💰₹${cell.customPrice}` : ""}${cell.isAccessible ? " ♿" : ""}${cell.isBlocked ? " 🚫" : ""}`
                            : `Empty (${ROW_LABELS[r]}${c + 1})`
                        }
                        className={`w-6 h-6 rounded-t cursor-pointer transition-all text-xs flex items-center justify-center relative ${
                          cell ? "" : "bg-gray-800 hover:bg-gray-700 border border-gray-700"
                        } ${cell?.isBlocked ? "opacity-30" : ""}`}
                        style={cell ? { ...seatStyle(cell.seatColor), outline: hasBestView ? `2px solid #f59e0b` : isGolden ? "1px solid #fbbf24" : "none", outlineOffset: "-1px" } : {}}
                      >
                        {hasBestView ? <span className="text-yellow-300" style={{ fontSize: "8px" }}>💰</span>
                          : isGolden ? <span className="text-yellow-300" style={{ fontSize: "8px" }}>★</span>
                          : cell?.isAccessible ? <span className="text-blue-300" style={{ fontSize: "8px" }}>♿</span>
                          : cell?.isBlocked ? <span className="text-red-400" style={{ fontSize: "8px" }}>×</span>
                          : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-6 text-xs text-gray-400">
            {seatTypes.map(type => (
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
              <div className="w-4 h-4 rounded-t bg-gray-600" style={{ outline: "2px solid #f59e0b", outlineOffset: "-1px" }} />
              <span>💰 Best View (custom price)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Best View Price Modal ── */}
      {showBestViewModal && bestViewTarget && (
        <BestViewModal
          cell={grid[bestViewTarget.key]}
          rowLabel={ROW_LABELS[bestViewTarget.r]}
          col={bestViewTarget.c}
          onSave={(price) => {
            setGrid(prev => ({
              ...prev,
              [bestViewTarget.key]: { ...prev[bestViewTarget.key], customPrice: price || null, isGolden: price ? true : prev[bestViewTarget.key].isGolden },
            }));
            setShowBestViewModal(false);
            setBestViewTarget(null);
          }}
          onClose={() => { setShowBestViewModal(false); setBestViewTarget(null); }}
        />
      )}

      {/* ── Pricing Modal ── */}
      {showPricing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold">Screen Pricing — {screen.name}</h2>
              <button onClick={() => setShowPricing(false)}><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-gray-500">Set base pricing per seat type. Individual "Best View" seats can override this with a custom price.</p>
              {seatTypes.map(type => (
                <div key={type.id} className="card p-3">
                  <div className="font-semibold mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: type.color }} />
                    {type.name}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "basePrice", label: "Base ₹" },
                      { key: "weekendPrice", label: "Weekend ₹" },
                      { key: "peakPrice", label: "Peak ₹" },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="label text-xs">{label}</label>
                        <input type="number" className="input text-sm" placeholder="0"
                          value={pricing[type.id]?.[key] || ""}
                          onChange={e => setPricing(prev => ({
                            ...prev,
                            [type.id]: { ...(prev[type.id] || {}), [key]: e.target.value },
                          }))} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {seatTypes.length === 0 && <p className="text-gray-500 text-center py-4">No seat types yet.</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowPricing(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={savePricing} className="btn-primary flex-1">Save Pricing</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Seat Type Manager Modal ── */}
      {showTypeManager && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-bold flex items-center gap-2"><Tag size={16} /> Seat Type Manager</h2>
              <button onClick={() => setShowTypeManager(false)}><X size={20} /></button>
            </div>
            <div className="p-4">
              {/* Create / Edit form */}
              <form onSubmit={saveType} className="card p-3 mb-4">
                <div className="text-sm font-semibold mb-3 text-gray-300">
                  {editingTypeId ? "Edit Seat Type" : "Add New Seat Type"}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="label">Name</label>
                    <input className="input" placeholder="e.g. Balcony, First Class…"
                      value={typeForm.name}
                      onChange={e => setTypeForm(p => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="label">Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" className="input h-10 p-1 w-16 shrink-0"
                        value={typeForm.color}
                        onChange={e => setTypeForm(p => ({ ...p, color: e.target.value }))} />
                      <input className="input text-xs font-mono" placeholder="#6b7280"
                        value={typeForm.color}
                        onChange={e => setTypeForm(p => ({ ...p, color: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="label">Description (optional)</label>
                  <input className="input" placeholder="e.g. Upper balcony with panoramic view"
                    value={typeForm.description}
                    onChange={e => setTypeForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                {/* Quick color presets */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {["#6b7280","#3b82f6","#8b5cf6","#f59e0b","#10b981","#ef4444","#ec4899","#f97316","#06b6d4","#84cc16"].map(c => (
                    <button key={c} type="button" onClick={() => setTypeForm(p => ({ ...p, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${typeForm.color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
                <div className="flex gap-2">
                  {editingTypeId && (
                    <button type="button" onClick={() => { setEditingTypeId(null); setTypeForm({ name: "", color: "#6b7280", description: "" }); }}
                      className="btn-secondary text-sm">Cancel</button>
                  )}
                  <button type="submit" disabled={savingType} className="btn-primary text-sm flex-1">
                    {savingType ? "Saving…" : editingTypeId ? "Update" : "Add Seat Type"}
                  </button>
                </div>
              </form>

              {/* Existing types list */}
              <div className="space-y-2">
                {seatTypes.map(type => (
                  <div key={type.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                    <div className="w-5 h-5 rounded-sm shrink-0" style={{ backgroundColor: type.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{type.name}</div>
                      {type.description && <div className="text-xs text-gray-400 truncate">{type.description}</div>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditType(type)} className="text-gray-400 hover:text-white p-1">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteType(type.id)} className="text-gray-400 hover:text-red-400 p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {seatTypes.length === 0 && (
                  <p className="text-center text-gray-500 py-4 text-sm">No seat types yet. Add one above.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BestViewModal({ cell, rowLabel, col, onSave, onClose }) {
  const [price, setPrice] = useState(cell?.customPrice || "");
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-bold">💰 Best View Price</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
            <div className="w-8 h-8 rounded-t flex items-center justify-center text-yellow-300" style={{ backgroundColor: cell?.seatColor }}>★</div>
            <div>
              <div className="font-semibold">Seat {rowLabel}{col + 1}</div>
              <div className="text-xs text-gray-400">{cell?.seatTypeName}</div>
            </div>
          </div>
          <div>
            <label className="label">Custom Price (₹) — overrides base pricing</label>
            <input type="number" className="input" placeholder="e.g. 750"
              value={price} onChange={e => setPrice(e.target.value)} autoFocus />
            <p className="text-xs text-gray-500 mt-1">Leave empty to remove custom price and use base pricing.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => onSave(price ? parseFloat(price) : null)} className="btn-primary flex-1">
              {price ? `Set ₹${price}` : "Remove Custom Price"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
