import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await login(usuario.trim(), password);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 70% 20%, rgba(255,204,0,0.15), transparent 45%), radial-gradient(circle at 20% 80%, rgba(255,204,0,0.08), transparent 40%)',
      }} />
      <form onSubmit={handleSubmit} className="relative bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-sm p-5 sm:p-8 space-y-5">
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="Bombastic Dreamers" className="w-20 h-20 mx-auto object-contain" />
          <div>
            <h1 className="font-display text-4xl text-[#ffcc00] tracking-wide">BOMBASTIC</h1>
            <p className="text-xs text-gray-400 tracking-[0.25em] uppercase mt-1">Dreamers</p>
          </div>
          <p className="text-sm text-gray-500">Inicia sesión para continuar</p>
        </div>

        {error && <p className="text-sm text-red-300 bg-red-950/50 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Usuario</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={sending}>
          {sending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
