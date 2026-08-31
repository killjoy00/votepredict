import { useState } from 'react'
import type { Bill } from '../types/index.js'
import { searchBills } from '../api/index.js'

interface Props {
  onPredict: (payload: {
    billDescription: string
    billTitle?: string
    billNumber?: string
    subjects?: string[]
    sponsors?: string[]
  }) => void
  predicting: boolean
}

export default function BillSearch({ onPredict, predicting }: Props) {
  const [mode, setMode] = useState<'search' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Bill[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Bill | null>(null)
  const [extraContext, setExtraContext] = useState('')

  // Manual mode
  const [manualTitle, setManualTitle] = useState('')
  const [manualDesc, setManualDesc] = useState('')

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    setSearchError(null)
    try {
      const bills = await searchBills(query.trim())
      setResults(bills)
      if (bills.length === 0) setSearchError('No bills found. Try different keywords.')
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Bill search failed.')
    } finally {
      setSearching(false)
    }
  }

  function handleSelect(bill: Bill) {
    setSelected(bill)
    setResults([])
    setExtraContext(bill.abstract ?? '')
  }

  function handlePredictSearch() {
    if (!selected) return
    onPredict({
      billTitle: selected.title,
      billNumber: selected.number,
      billDescription: extraContext || selected.abstract || selected.subjects.join(', ') || selected.title,
      subjects: selected.subjects,
      sponsors: selected.sponsors.filter((s) => s.primary).map((s) => s.name),
    })
  }

  function handlePredictManual() {
    if (!manualDesc.trim()) return
    onPredict({
      billTitle: manualTitle.trim() || 'Unnamed Bill',
      billDescription: manualDesc.trim(),
    })
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
        {(['search', 'manual'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {m === 'search' ? '🔍 Search Current Bills' : '✏️ Enter Manually'}
          </button>
        ))}
      </div>

      {mode === 'search' ? (
        <div className="space-y-3">
          {/* Search input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by keyword or bill number (e.g. HF 1234)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              maxLength={120}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {/* Results dropdown */}
          {results.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {results.map((bill) => (
                <button
                  key={bill.id}
                  onClick={() => handleSelect(bill)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                >
                  <p className="font-medium text-sm text-gray-900 leading-tight">{bill.number}: {bill.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{bill.status} · {bill.session}</p>
                </button>
              ))}
            </div>
          )}

          {searchError && !selected && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{searchError}</p>
          )}

          {/* Selected bill card */}
          {selected && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-blue-900 leading-tight">{selected.number}: {selected.title}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Session: {selected.session}</p>
                  {selected.sourceUrl && (
                    <a
                      href={selected.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-blue-700 underline underline-offset-2 mt-1 hover:text-blue-900"
                    >
                      View official bill record
                    </a>
                  )}
                  {selected.subjects.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Topics: {selected.subjects.join(', ')}</p>
                  )}
                </div>
                <button
                  onClick={() => { setSelected(null); setExtraContext('') }}
                  className="text-blue-300 hover:text-blue-600 text-lg leading-none shrink-0"
                >✕</button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Bill description / context for AI analysis
                </label>
                <textarea
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  rows={4}
                  maxLength={12000}
                  placeholder="Paste or edit the bill summary here…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
              </div>

              <button
                onClick={handlePredictSearch}
                disabled={predicting}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {predicting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Analyzing with Claude…
                  </span>
                ) : '🤖 Predict Votes'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bill Title</label>
            <input
              type="text"
              placeholder="e.g., Clean Energy Standards Act"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              maxLength={300}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Bill Description / Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Paste the bill's description, key provisions, or summary here. The more detail you provide, the more accurate the prediction."
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              rows={7}
              maxLength={12000}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handlePredictManual}
            disabled={predicting || !manualDesc.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {predicting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Analyzing with Claude…
              </span>
            ) : '🤖 Predict Votes with AI'}
          </button>
        </div>
      )}
    </div>
  )
}
