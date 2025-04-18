"use client"

import { supabase } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export const useSupabase = () => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) return null
  return supabase
}