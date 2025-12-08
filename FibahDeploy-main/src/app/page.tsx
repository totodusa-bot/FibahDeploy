'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signInWithEmail, signUpWithEmail } from './actions/auth'

export default function SignInPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const result = isSignUp
        ? await signUpWithEmail(formData)
        : await signInWithEmail(formData)

      if (result?.error) {
        setError(result.error)
      } else if (result && 'success' in result && result.success) {
        setSuccess(result.success)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden border-0 shadow-2xl bg-white/95 backdrop-blur-sm rounded-2xl">
          {/* Top gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />

          <div className="p-8 sm:p-10 md:pt-12 md:pb-10 md:px-10">
            <div className="flex flex-col items-center text-center space-y-6 sm:space-y-8">
              {/* Logo */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full blur-xl opacity-30 group-hover:opacity-40 transition-opacity duration-300" />
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 shadow-lg ring-4 ring-white/50 group-hover:shadow-xl transition-all duration-300 rounded-full bg-[#111d31] flex items-center justify-center">
                  <div className="text-[#40c23a] text-3xl sm:text-4xl font-bold">FD</div>
                </div>
              </div>

              {/* Heading */}
              <div className="space-y-2 sm:space-y-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Welcome to FiberDeploy
                </h1>
                <p className="text-slate-500 text-sm sm:text-base font-medium">
                  Sign in to continue
                </p>
              </div>

              <div className="w-full">
                {/* Error/Success Messages */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
                    {success}
                  </div>
                )}

                {/* Email/Password Form */}
                <form onSubmit={handleEmailSubmit} className="space-y-4 sm:space-y-5">
                  <div className="space-y-3 sm:space-y-4">
                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="email"
                        className="text-sm font-medium text-slate-700"
                      >
                        Email
                      </Label>
                      <div className="relative">
                        <img
                          src="https://ext.same-assets.com/329238692/1507563971.svg"
                          alt=""
                          width="16"
                          height="16"
                          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 opacity-50"
                          style={{ width: '16px', height: '16px' }}
                        />
                        <Input
                          type="email"
                          id="email"
                          name="email"
                          placeholder="you@example.com"
                          required
                          className="pl-10 h-11 sm:h-12 bg-slate-50/50 border-slate-200 focus:border-slate-400 focus:ring-slate-400 rounded-xl placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="password"
                        className="text-sm font-medium text-slate-700"
                      >
                        Password
                      </Label>
                      <div className="relative">
                        <img
                          src="https://ext.same-assets.com/329238692/332363222.svg"
                          alt=""
                          width="16"
                          height="16"
                          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 opacity-50"
                          style={{ width: '16px', height: '16px' }}
                        />
                        <Input
                          type="password"
                          id="password"
                          name="password"
                          placeholder="••••••••"
                          required
                          className="pl-10 h-11 sm:h-12 bg-slate-50/50 border-slate-200 focus:border-slate-400 focus:ring-slate-400 rounded-xl placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 sm:h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm rounded-xl transition-all duration-200"
                    >
                      {loading ? 'Please wait...' : isSignUp ? 'Sign up' : 'Sign in'}
                    </Button>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
                      <button
                        type="button"
                        className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
                      >
                        Forgot password?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(!isSignUp)
                          setError(null)
                          setSuccess(null)
                        }}
                        className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        {isSignUp ? 'Already have an account?' : 'Need an account?'}{' '}
                        <span className="font-medium text-slate-700">
                          {isSignUp ? 'Sign in' : 'Sign up'}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400 sm:hidden">
          <p>&nbsp;</p>
        </div>
      </div>
    </div>
  )
}
