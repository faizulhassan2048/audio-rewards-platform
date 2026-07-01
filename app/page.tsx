import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-600">YouTask</h1>
          <div className="space-x-4">
            <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">
              Login
            </Link>
            <Link 
              href="/auth/register" 
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Listen. <span className="text-purple-600">Earn.</span> Withdraw.
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Earn real rewards by listening to audio content.
        </p>
        <Link href="/auth/register">
          <button className="px-8 py-4 bg-purple-600 text-white rounded-lg text-lg hover:bg-purple-700">
            Get Started Free
          </button>
        </Link>
      </section>
    </main>
  );
}