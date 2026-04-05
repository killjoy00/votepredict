import { useState, useMemo } from 'react'
import type { Legislator, LegislatorPrediction } from '../types/index.js'

interface Props {
  legislators: Legislator[]
  predictions?: Map<string, LegislatorPrediction>
  loading: boolean
  error?: string | null
}

const PARTY_CHIP: Record<string, string> = {
  DFL: 'bg-blue-100 text-blue-800 border border-blue-200',
  Republican: 'bg-red-100 text-red-800 border border-red-200',
  Independent: 'bg-gray-100 text-gray-700 border border-gray-200',
}

const VOTE_ROW: Record<string, string> = {
  yes: 'bg-green-50 hover:bg-green-100',
  no: 'bg-red-50 hover:bg-red-100',
  abstain: 'bg-yellow-50 hover:bg-yellow-100',
}

const VOTE_CHIP: Record<string, string> = {
  yes: 'bg-green-100 text-green-800 border border-green-200',
  no: 'bg-red-100 text-red-800 border border-red-200',
  abstain: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
}

export default function LegislatorTable({ legislators, predictions, loading, error }: Props) {
  const [activeTab, setActiveTab] = useState<'house' | 'senate'>('house')
  const [search, setSearch] = useState('')
  const [partyFilter, setPartyFilter] = useState('all')
  const [voteFilter, setVoteFilter] = useState('all')

  const houseCount = legislators.filter((l) => l.chamber === 'house').length
  const senateCount = legislators.filter((l) => l.chamber === 'senate').length

  const chamberLegislators = useMemo(
    () => legislators.filter((l) => l.chamber === activeTab),
    [legislators, activeTab]
  )

  const parties = useMemo(
    () => [...new Set(chamberLegislators.map((l) => l.party))].sort(),
    [chamberLegislators]
  )

  const filtered = useMemo(() => {
    return chamberLegislators.filter((l) => {
      const q = search.toLowerCase()
      if (q && !l.name.toLowerCase().includes(q) && !l.district.toLowerCase().includes(q)) return false
      if (partyFilter !== 'all' && l.party !== partyFilter) return false
      if (voteFilter !== 'all' && predictions) {
        const p = predictions.get(l.id)
        if (!p || p.vote !== voteFilter) return false
      }
      return true
    })
  }, [chamberLegislators, search, partyFilter, voteFilter, predictions])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="text-gray-500 text-sm">Loading legislators from OpenStates...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-center px-4">
        <span className="text-3xl">⚠️</span>
        <p className="text-red-600 font-medium text-sm">{error}</p>
        <p className="text-gray-400 text-xs">Check your OpenStates API key or try again shortly.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chamber Tabs */}
      <div className="flex border-b border-gray-200 mb-3 shrink-0">
        {(['house', 'senate'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setActiveTab(c)}
            className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === c
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {c === 'house' ? `House (${houseCount})` : `Senate (${senateCount})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-2 shrink-0">
        <input
          type="text"
          placeholder="Search name or district…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={partyFilter}
          onChange={(e) => setPartyFilter(e.target.value)}
          className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="all">All parties</option>
          {parties.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {predictions && (
          <select
            value={voteFilter}
            onChange={(e) => setVoteFilter(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="all">All votes</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="abstain">Abstain</option>
          </select>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-2 shrink-0">
        Showing {filtered.length} of {chamberLegislators.length}
        {predictions && ` · hover a row for AI reasoning`}
      </p>

      {/* Table */}
      <div className="overflow-auto flex-1 border border-gray-200 rounded-lg min-h-0">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600 border-b border-gray-200">Name</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 border-b border-gray-200">Party</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 border-b border-gray-200">District</th>
              {predictions && (
                <th className="text-left px-3 py-2 font-medium text-gray-600 border-b border-gray-200">Prediction</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((leg, i) => {
              const pred = predictions?.get(leg.id)
              const rowClass = pred
                ? VOTE_ROW[pred.vote]
                : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'

              return (
                <tr
                  key={leg.id}
                  className={`${rowClass} transition-colors cursor-default`}
                  title={pred?.reasoning}
                >
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{leg.name}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PARTY_CHIP[leg.party] ?? PARTY_CHIP['Independent']}`}>
                      {leg.party}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{leg.district}</td>
                  {predictions && (
                    <td className="px-3 py-2">
                      {pred ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${VOTE_CHIP[pred.vote]}`}>
                          {pred.vote} <span className="font-normal opacity-60">{pred.confidence}%</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No legislators match your filters.</div>
        )}
      </div>
    </div>
  )
}
