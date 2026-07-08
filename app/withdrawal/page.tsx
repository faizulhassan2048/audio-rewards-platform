'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Wallet, AlertCircle, CheckCircle,
  Clock, XCircle, Banknote, Smartphone, Building2, Info
} from 'lucide-react'
import BackButton from '@/components/ui/BackButton'

interface WithdrawalHistory {
  id: string
  amount_coins: number
  amount_pkr: number
  method: string
  account_number: string
  status: string
  admin_note: string
  payment_reference: string
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:    { label: 'Pending',    color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock },
  approved:   { label: 'Approved',   color: 'text-blue-700',   bg: 'bg-blue-100',   icon: CheckCircle },
  processing: { label: 'Processing', color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Clock },
  paid:       { label: 'Paid',       color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle },
  rejected:   { label: 'Rejected',   color: 'text-red-700',    bg: 'bg-red-100',    icon: XCircle },
}

const METHOD_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  easypaisa:     { label: 'EasyPaisa',     icon: Smartphone,  color: 'text-green-600' },
  jazzcash:      { label: 'JazzCash',      icon: Smartphone,  color: 'text-red-600'   },
  bank_transfer: { label: 'Bank Transfer', icon: Building2,   color: 'text-blue-600'  },
}

export default function WithdrawalPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [pending, setPending] = useState(0)
  const [history, setHistory] = useState<WithdrawalHistory[]>([])
  
  // Track if first withdrawal
  const [isFirstWithdrawal, setIsFirstWithdrawal] = useState(true)

  const [form, setForm] = useState({
    amount_coins: '',
    method: 'easypaisa',
    account_number: '',
    account_name: '',
    bank_name: '',
  })

  // 🔄 CHANGED: New rate 100 coins = PKR 50
  const COINS_TO_PKR = 0.50  // 100 coins = PKR 50
  
  // 🔄 CHANGED: New minimum amounts
  const MIN_COINS_FIRST = 1500       // 1500 coins = PKR 750
  const MIN_COINS_SUBSEQUENT = 500   // 500 coins = PKR 250

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const [walletRes, historyRes] = await Promise.all([
        supabase.from('wallets').select('coin_balance, pending_withdrawal').eq('user_id', user.id).single(),
        fetch(`/api/withdrawals?user_id=${user.id}`).then(r => r.json()),
      ])

      setBalance(walletRes.data?.coin_balance || 0)
      setPending(walletRes.data?.pending_withdrawal || 0)
      setHistory(historyRes.withdrawals || [])
      
      // Check if first withdrawal
      setIsFirstWithdrawal((historyRes.withdrawals || []).length === 0)
      
    } catch {
      toast.error('Error loading data')
    } finally {
      setLoading(false)
    }
  }

  // Get dynamic minimum amount
  const getMinCoins = () => {
    return isFirstWithdrawal ? MIN_COINS_FIRST : MIN_COINS_SUBSEQUENT
  }

  // Get dynamic minimum message
  const getMinMessage = () => {
    if (isFirstWithdrawal) {
      return `First withdrawal minimum ${MIN_COINS_FIRST} coins (PKR ${(MIN_COINS_FIRST * COINS_TO_PKR).toFixed(0)})`
    }
    return `Minimum ${MIN_COINS_SUBSEQUENT} coins (PKR ${(MIN_COINS_SUBSEQUENT * COINS_TO_PKR).toFixed(0)})`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    const coins = parseInt(form.amount_coins)
    const minCoins = getMinCoins()

    // Dynamic minimum validation
    if (!coins || coins < minCoins) {
      toast.error(`Minimum withdrawal is ${minCoins} coins${isFirstWithdrawal ? ' for first withdrawal' : ''}`)
      return
    }
    if (coins > balance) {
      toast.error('Insufficient balance')
      return
    }
    if (form.method === 'bank_transfer' && !form.bank_name.trim()) {
      toast.error('Bank name is required for bank transfer')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          amount_coins: coins,
          method: form.method,
          account_number: form.account_number.trim(),
          account_name: form.account_name.trim(),
          bank_name: form.bank_name.trim() || null,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('✅ Withdrawal request submitted!')
        setForm({ amount_coins: '', method: 'easypaisa', account_number: '', account_name: '', bank_name: '' })
        loadData()
      } else {
        toast.error(data.error || 'Submission failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const pkrAmount = (parseInt(form.amount_coins) || 0) * COINS_TO_PKR
  const minCoins = getMinCoins()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white pb-10">

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <BackButton />
          <h1 className="font-bold text-gray-900">Withdraw Coins</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-2xl p-5 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-100 text-xs uppercase tracking-wider">Available Balance</p>
              <p className="text-4xl font-bold mt-1">{Number(balance).toLocaleString()}</p>
              <p className="text-purple-200 text-sm">coins = PKR {(balance * COINS_TO_PKR).toFixed(2)}</p>
            </div>
            <Wallet className="w-8 h-8 text-purple-200" />
          </div>
          {pending > 0 && (
            <div className="mt-3 bg-white/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-200" />
              <p className="text-sm text-purple-100">
                <span className="font-bold text-white">{pending} coins</span> pending withdrawal
              </p>
            </div>
          )}
        </div>

        {/* Form - Now comes BEFORE Info Box */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow border border-gray-100 p-5 space-y-4">
          <h2 className="font-bold text-gray-800">New Withdrawal Request</h2>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Amount (Coins)
            </label>
            <input
              type="number"
              min={minCoins}
              max={balance}
              placeholder={getMinMessage()}
              value={form.amount_coins}
              onChange={(e) => setForm({ ...form, amount_coins: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              required
            />
            {form.amount_coins && (
              <p className="text-sm text-purple-600 font-semibold mt-1 ml-1">
                = PKR {pkrAmount.toFixed(2)}
              </p>
            )}
            {/* Show minimum requirement message */}
            <p className="text-xs text-gray-500 mt-1 ml-1">
              {isFirstWithdrawal 
                ? `🔵 First withdrawal: minimum ${MIN_COINS_FIRST} coins (PKR ${(MIN_COINS_FIRST * COINS_TO_PKR).toFixed(0)})` 
                : `🟢 Subsequent withdrawals: minimum ${MIN_COINS_SUBSEQUENT} coins (PKR ${(MIN_COINS_SUBSEQUENT * COINS_TO_PKR).toFixed(0)})`}
            </p>
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(METHOD_CONFIG).map(([key, val]) => {
                const Icon = val.icon
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, method: key, bank_name: '' })}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      form.method === key
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${form.method === key ? 'text-purple-600' : val.color}`} />
                    <span className={`text-xs font-medium ${form.method === key ? 'text-purple-700' : 'text-gray-600'}`}>
                      {val.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {form.method === 'bank_transfer' ? 'Account Number' : 'Mobile Number'}
            </label>
            <input
              type="text"
              placeholder={form.method === 'bank_transfer' ? 'Account number' : '03XXXXXXXXX'}
              value={form.account_number}
              onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              required
            />
          </div>

          {/* Bank name — only for bank transfer */}
          {form.method === 'bank_transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. HBL, UBL, Meezan Bank"
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                required
              />
            </div>
          )}

          {/* Account Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Holder Name</label>
            <input
              type="text"
              placeholder="Name on account"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              required
              minLength={3}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !form.amount_coins || balance < minCoins}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
            ) : (
              <><Banknote className="w-5 h-5" /> Submit Withdrawal Request</>
            )}
          </button>
        </form>

        {/* Info box - Now comes AFTER Form */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-1">Withdrawal Info</p>
            <ul className="space-y-0.5 text-blue-600">
              {/* 🔄 CHANGED: Updated text with new rates */}
              <li>• First withdrawal: minimum 1,500 coins (PKR 750)</li>
              <li>• Subsequent withdrawals: minimum 500 coins (PKR 250)</li>
              <li>• Rate: 100 coins = PKR 50</li>
              <li>• Max 1 request per day</li>
              <li>• First withdrawal: manual verify (24-48 hrs)</li>
            </ul>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Withdrawal History</h2>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-10">
              <Wallet className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No withdrawals yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map((w) => {
                const status = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending
                const StatusIcon = status.icon
                const method = METHOD_CONFIG[w.method]
                return (
                  <div key={w.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">{w.amount_coins} coins</span>
                          <span className="text-gray-400 text-sm">= PKR {w.amount_pkr}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {method?.label} • {w.account_number}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(w.created_at).toLocaleDateString('en-PK', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        {w.admin_note && (
                          <p className="text-xs text-red-500 mt-1">Note: {w.admin_note}</p>
                        )}
                        {w.payment_reference && (
                          <p className="text-xs text-green-600 mt-1">Ref: {w.payment_reference}</p>
                        )}
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}