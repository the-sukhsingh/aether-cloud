"use client"
import React from 'react'
import { ThemeProvider } from './theme/ThemeProvider'
import { NotiRoot } from 'noti-toast'

const Providers = ({ children }: { children: React.ReactNode }) => {
    return (
        <>
            <ThemeProvider>
                <NotiRoot /> 
                {children}
            </ThemeProvider>
        </>
    )
}

export default Providers