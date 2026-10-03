import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import LazyBackground from './components/LazyBackground'
import Navbar from './components/Navbar'
import PageTransition from './components/PageTransition'
import { GuestOnly, Protected } from './components/RouteGuards'
import { AuthProvider } from './lib/auth'
import { SmoothScroll } from './lib/motion'
import { ThemeProvider } from './lib/theme'
import Landing from './pages/Landing'

// App pages are code-split; they load while the page-transition curtain is down
const Auth = lazy(() => import('./pages/Auth'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Coach = lazy(() => import('./pages/Coach'))

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SmoothScroll>
            <LazyBackground />
            <Navbar />
            <PageTransition>
              {(location) => (
                <Suspense fallback={<div className="page" />}>
                  <Routes location={location}>
                    <Route path="/" element={<Landing />} />
                    <Route
                      path="/auth"
                      element={
                        <GuestOnly>
                          <Auth />
                        </GuestOnly>
                      }
                    />
                    <Route
                      path="/onboarding"
                      element={
                        <Protected>
                          <Onboarding />
                        </Protected>
                      }
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <Protected needsProfile>
                          <Dashboard />
                        </Protected>
                      }
                    />
                    <Route
                      path="/coach"
                      element={
                        <Protected needsProfile>
                          <Coach />
                        </Protected>
                      }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              )}
            </PageTransition>
          </SmoothScroll>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
