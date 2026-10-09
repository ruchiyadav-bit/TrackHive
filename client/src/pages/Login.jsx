import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSiteSettings } from '../hooks/useSiteSettings';

export default function Login() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [rememberMe, setRememberMe] = useState(false);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const { login } = useAuth();
 const { siteName } = useSiteSettings();
 const navigate = useNavigate();

 const handleSubmit = async (e) => {
 e.preventDefault();
 setError('');
 setLoading(true);
 try {
 await login(email, password, rememberMe);
 navigate('/');
 } catch (err) {
 setError(err.response?.data?.error || 'Login failed');
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
 <div className="w-full max-w-md">
 <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
 <div className="text-center mb-8">
 <h1 className="text-2xl font-bold text-blue-600">{siteName}</h1>
 <p className="text-sm text-gray-500 mt-1">Sign in to your dashboard</p>
 </div>

 {error && (
 <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900"
 placeholder="you@example.com"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
 <input
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-900"
 placeholder="Enter your password"
 />
 </div>
 <div className="flex items-center">
 <input
 type="checkbox"
 id="remember"
 checked={rememberMe}
 onChange={(e) => setRememberMe(e.target.checked)}
 className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
 />
 <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
 Remember me
 </label>
 </div>
 <button
 type="submit"
 disabled={loading}
 className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
 >
 {loading ? 'Signing in...' : 'Sign In'}
 </button>
 </form>

 <p className="text-center text-sm text-gray-500 mt-6">
 Don't have an account?{' '}
 <Link to="/signup" className="text-blue-600 hover:text-blue-800 font-medium">
 Sign up
 </Link>
 </p>
 <nav aria-label="Public information" className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-gray-100 pt-5 text-xs">
 <Link to="/tracker-info" className="text-gray-500 hover:text-blue-700">Click Tracker</Link>
 <Link to="/privacy" className="text-gray-500 hover:text-blue-700">Privacy</Link>
 <Link to="/contact" className="text-gray-500 hover:text-blue-700">Contact</Link>
 </nav>
 </div>
 </div>
 </div>
 );
}
