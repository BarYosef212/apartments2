import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Input } from '../components/ui';
import { clearToken, setToken } from '../lib/auth';
import { useAuthApi } from '../hooks/useAuthApi';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthApi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { token } = await login(email, password);
      clearToken();
      setToken(token);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16'>
      <Card>
        <CardContent className='space-y-8 p-8'>
          <div className='space-y-2 text-right'>
            <h1 className='font-display text-5xl font-light leading-none'>
              כניסת מנהל
            </h1>
            <p className='text-sm text-muted-foreground'>
              הזן את פרטי המנהל כדי לנהל את הדירות במערכת.
            </p>
          </div>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-1'>
              <label
                className='text-xs font-medium text-ink'
                htmlFor='email'
              >
                אימייל
              </label>
              <Input
                id='email'
                type='email'
                autoComplete='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className='space-y-1 '>
              <label
                className='text-xs font-medium text-ink'
                htmlFor='password'
              >
                סיסמה
              </label>
              <Input
                id='password'
                type='password'
                autoComplete='current-password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className='text-xs text-red-500'>{error}</p>}
            <Button type='submit' disabled={isLoading} className='w-full'>
              {isLoading ? 'מתחבר...' : 'התחברות'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
