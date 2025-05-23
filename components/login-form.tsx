"use client"

import { useEffect, useState } from "react"
import { auth, googleProvider, githubProvider } from "@/lib/firebase"
import { signInWithPopup, onAuthStateChanged } from "firebase/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { GitHubLogoIcon } from "@radix-ui/react-icons"
import { GithubAuthProvider } from "firebase/auth"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Wait for auth state to be ready
      await auth.authStateReady()
      
      if (user) {
        window.location.href = '/dashboard'
      }
    })
    return () => unsubscribe()
  }, [])

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      toast.error(`Login failed: ${error.message}`)
      console.error('Authentication error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitHubLogin = async () => {
    setIsLoading(true)
    try {
      await signInWithPopup(auth, githubProvider)
    } catch (error) {
      toast.error(`Login failed: ${error.message}`)
      console.error('Authentication error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="p-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Choose your preferred login method
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-10">
          <div className="flex flex-col gap-6">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-4 w-4"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGitHubLogin}
              disabled={isLoading}
            >
              <GitHubLogoIcon className="h-4 w-4" />
              Continue with GitHub
            </Button>
          </div>
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            By continuing, you agree to our{" "}
            <a href="/terms" className="underline underline-offset-4">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
