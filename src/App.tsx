import { useState, useEffect, useMemo } from 'react'
import Header from './components/Header.tsx'
import LegislatorTable from './components/LegislatorTable.tsx'
import BillSearch from './components/BillSearch.tsx'
import VotePrediction from './components/VotePrediction.tsx'
import type { Legislator, LegislatorPrediction, LegislatorRoster, VotePredictionResult } from './types/index.js'
import { fetchLegislators, predictVotes } from './api/index.js'

export default function App() {
  const [legislators, setLegislators] = useState<Legislator[]>([])
  const [rosterInfo, setRosterInfo] = useState<Omit<LegislatorRoster, 'legislators'> | null>(null)
  const [legLoading, setLegLoading] = useState(true)
  const [legError, setLegError] = useState<string | null>(null)

  const [predicting, setPredicting] = useState(false)
  const [predictError, setPredictError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<VotePredictionResult | null>(null)

  useEffect(() => {
    setLegLoading(true)
    fetchLegislators()
      .then(({ legislators: roster, ...info }) => {
        setLegislators(roster)
        setRosterInfo(info)
      })
      .catch((e: Error) => setLegError(e.message))
      .finally(() => setLegLoading(false))
  }, [])

  const predictionMap = useMemo(() => {
    if (!prediction) return undefined
    const m = new Map<string, LegislatorPrediction>()
    for (const p of prediction.predictions) m.set(p.legislatorId, p)
    return m
  }, [prediction])

  async function handlePredict(payload: {
    billDescription: string
    billTitle?: string
    billNumber?: string
    subjects?: string[]
    sponsors?: string[]
  }) {
    setPredicting(true)
    setPredictError(null)
    setPrediction(null)
    try {
      setPrediction(await predictVotes(payload))
    } catch (e: unknown) {
      setPredictError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setPredicting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-5 gap-5"
        style={{ minHeight: 0 }}>

        {/* Left: Legislators */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col lg:h-[calc(100vh-130px)]">
          <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
            <div>
              <h2 className="text-base font-bold text-gray-900">94th Legislature Members</h2>
              {rosterInfo && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {rosterInfo.source === 'openstates' ? 'OpenStates' : rosterInfo.source === 'minnesota-legislature' ? 'Official Minnesota Legislature' : 'Verified official snapshot'}
                  {' · '}updated {new Date(rosterInfo.asOf).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                </p>
              )}
            </div>
            {!legLoading && !legError && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                {legislators.length} members
              </span>
            )}
          </div>
          <LegislatorTable
            legislators={legislators}
            predictions={predictionMap}
            loading={legLoading}
            error={legError}
          />
        </div>

        {/* Right: Prediction panel */}
        <div className="lg:col-span-2 flex flex-col gap-4 lg:h-[calc(100vh-130px)] lg:overflow-y-auto">

          {/* Bill input card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 shrink-0">
            <h2 className="text-base font-bold text-gray-900 mb-4">Bill Vote Predictor</h2>
            <BillSearch onPredict={handlePredict} predicting={predicting} />
            {predictError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <strong>Error:</strong> {predictError}
              </div>
            )}
          </div>

          {/* Loading state */}
          {predicting && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Building an estimate…</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Reviewing {legislators.length} legislators against the bill. This may take up to 30 seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Prediction results */}
          {prediction && !predicting && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 shrink-0">
              <VotePrediction result={prediction} />
            </div>
          )}

          {/* Empty state */}
          {!prediction && !predicting && !predictError && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="text-4xl mb-3">🗳️</div>
              <p className="text-gray-500 text-sm leading-relaxed">
                Search for a current Minnesota bill or paste a description to predict how every legislator will vote.
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Members will be color-coded by estimated yes, no, abstain, or uncertain votes after prediction.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
