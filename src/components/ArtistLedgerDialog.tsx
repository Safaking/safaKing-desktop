'use client';

import React from 'react';
import { X, Plus, Trash2, IndianRupee, Loader2, BookOpen, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  artist: any;
  onClose: () => void;
}

export default function ArtistLedgerDialog({ artist, onClose }: Props) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [paidAt, setPaidAt] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/artists/${artist.id}/payments`);
      const json = await res.json();
      if (res.ok) setData(json);
      else alert(json.error || 'Failed to load ledger');
    } catch (e: any) {
      alert(e.message || 'Error loading ledger');
    } finally {
      setLoading(false);
    }
  }, [artist.id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/artists/${artist.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, note, paidAt }),
      });
      const json = await res.json();
      if (res.ok) {
        setAmount('');
        setNote('');
        setPaidAt(format(new Date(), 'yyyy-MM-dd'));
        loadData();
      } else {
        alert(json.error || 'Failed to add payment');
      }
    } catch (e: any) {
      alert(e.message || 'Error adding payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm('हटाना चाहते हैं?')) return;
    setDeleting(paymentId);
    try {
      const res = await fetch(`/api/artists/${artist.id}/payments?paymentId=${paymentId}`, {
        method: 'DELETE',
      });
      if (res.ok) loadData();
      else {
        const json = await res.json();
        alert(json.error || 'Failed to delete');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">{artist.name} — खाता बही</h3>
              <p className="text-xs text-slate-500">Artist Payment Ledger</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : data ? (
            <>
              {/* Summary Cards */}
              <div className="p-5 grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-1">कुल कमाई</p>
                  <p className="text-xl font-black text-blue-800">{fmt(data.totalEarned)}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">{data.orders.length} orders</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide mb-1">भुगतान किया</p>
                  <p className="text-xl font-black text-emerald-800">{fmt(data.totalPaidViaLedger)}</p>
                  <p className="text-[10px] text-emerald-500 mt-0.5">{data.payments.length} entries</p>
                </div>
                <div className={`rounded-xl p-3 text-center border ${data.balance > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${data.balance > 0 ? 'text-rose-600' : 'text-slate-500'}`}>बाकी / Balance</p>
                  <p className={`text-xl font-black ${data.balance > 0 ? 'text-rose-700' : 'text-slate-600'}`}>{fmt(data.balance)}</p>
                  <p className={`text-[10px] mt-0.5 ${data.balance > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {data.balance > 0 ? 'Due' : 'Clear ✓'}
                  </p>
                </div>
              </div>

              {/* Orders Toggle */}
              {data.orders.length > 0 && (
                <div className="px-5 pb-3">
                  <button
                    onClick={() => setExpandedOrders(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp size={15} className="text-indigo-500" />
                      Orders ({data.orders.length}) — प्रति साफा: ₹{artist.ratePerPiece || 0}
                    </span>
                    <span className="text-slate-400 text-xs">{expandedOrders ? '▲ Hide' : '▼ Show'}</span>
                  </button>
                  {expandedOrders && (
                    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold text-slate-600">Order</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600">ग्राहक</th>
                            <th className="px-3 py-2 text-center font-bold text-slate-600">साफे</th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600">Rate</th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600">Earned</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.orders.map((o: any) => (
                            <tr key={o.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono font-bold text-indigo-600">{o.orderNumber}</td>
                              <td className="px-3 py-2 text-slate-700 max-w-[100px] truncate">{o.customerName}</td>
                              <td className="px-3 py-2 text-center font-bold text-slate-800">{o.safaTyingCount || 0}</td>
                              <td className="px-3 py-2 text-right text-slate-600">₹{o.artistRate || 0}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-800">₹{o.earned}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Add Payment Form */}
              <div className="px-5 pb-4">
                <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4">
                  <p className="text-xs font-bold text-indigo-700 mb-3 flex items-center gap-1.5">
                    <Plus size={13} /> नया भुगतान जोड़ें
                  </p>
                  <form onSubmit={handleAddPayment} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 font-bold text-sm">₹</span>
                        <input
                          required
                          type="number"
                          min="1"
                          step="1"
                          placeholder="राशि (Amount)"
                          className="w-full pl-7 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                        />
                      </div>
                      <input
                        type="date"
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                        value={paidAt}
                        onChange={e => setPaidAt(e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Note (optional) — e.g. UPI, Cash advance"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={saving || !amount}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <IndianRupee size={15} />}
                      {saving ? 'Saving…' : 'भुगतान जोड़ें (Add Payment)'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Payment History */}
              <div className="px-5 pb-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  भुगतान इतिहास ({data.payments.length})
                </p>
                {data.payments.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-100">
                    कोई भुगतान दर्ज नहीं है।
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl">
                        <div className="min-w-0">
                          <p className="font-bold text-emerald-700 text-sm">
                            + {fmt(p.amount)}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {format(new Date(p.paidAt), 'dd MMM yyyy')}
                            {p.note ? ` · ${p.note}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                        >
                          {deleting === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
