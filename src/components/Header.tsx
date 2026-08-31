export default function Header() {
  return (
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-(--breakpoint-2xl) mx-auto px-6 py-4 flex items-center gap-3">
        <span className="text-3xl">🏛️</span>
        <div>
          <h1 className="text-xl font-bold leading-tight">
            Minnesota Legislator Vote Predictor
          </h1>
          <p className="text-blue-300 text-xs mt-0.5">
            Exploratory AI estimates using official Minnesota legislative data
          </p>
        </div>
      </div>
    </header>
  )
}
