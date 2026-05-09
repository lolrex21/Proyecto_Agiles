import IncidentReportForm from './components/IncidentReportForm'

function App() {
  return (
    <div className="min-h-screen bg-uta-gray">
      <header className="bg-uta-navy text-white py-4 px-4 shadow-md">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-uta-gold flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-uta-navy" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-wide">UTA Security</h1>
        </div>
      </header>
      <main className="pb-8">
        <IncidentReportForm />
      </main>
    </div>
  )
}

export default App
