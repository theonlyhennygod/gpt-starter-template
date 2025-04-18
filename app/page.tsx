"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import {
    ChevronDown, ChevronLeft, ChevronRight, Download, Info, Mic2, Moon, Plus, Send, Share2, Sun, Copy, LogOut, LogIn, Github, User
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Image from "next/image";
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { VoiceWaveform } from '@/components/VoiceWaveform';
import { motion, AnimatePresence } from "framer-motion";
import robotImage from '@/public/images/robot.jpg'; // Ensure path is correct relative to new location

// Define Message and ChatHistory interfaces (same as before)
interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface ChatHistory {
    id: string;
    title: string;
    timestamp: Date; // Keep as Date object for sorting
    messages: Message[];
    participants?: string[]; // Keep participants if using Firestore save
    lastUpdated?: Date;     // Keep lastUpdated if using Firestore save
}

// Animation variants (same as before)
const messageVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, x: -50 } };
const loadingVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

// --- Dashboard Content Component (Simplified) ---
function DashboardContent() {
    // --- State variables (same as before) ---
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [leftSidebarCollapsed, setLeftSidebarCollapsed] = React.useState(false);
    const [rightSidebarCollapsed, setRightSidebarCollapsed] = React.useState(false);
    const { theme, setTheme } = useTheme();
    const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
    const { isRecording, startRecording, stopRecording, error, audioLevel } = useVoiceRecording();
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [microphoneError, setMicrophoneError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController>();
    const { copied, copy } = useCopyToClipboard(); // Assuming useCopyToClipboard is defined elsewhere or added here
    const [isMounted, setIsMounted] = useState(false);

    // --- Static User Data Placeholder ---
    const staticUser = {
        name: "Chat User",
        avatar: undefined // Or a default avatar path like '/avatar-placeholder.png'
    };

    // --- useEffect hooks (same as before, adjusted for user prop) ---
     useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages, isLoading]);

    useEffect(() => {
        // Microphone check logic (same as before)
         const checkMicrophone = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const hasAudioInput = devices.some(device => device.kind === 'audioinput');
                setMicrophoneError(hasAudioInput ? null : 'No microphone detected.');
            } catch (err) {
                console.error('Device enumeration error:', err);
                setMicrophoneError('Failed to access microphone devices');
            }
        };
        checkMicrophone();
    }, []);

    useEffect(() => {
        setIsMounted(true); // Set to true only after initial render on client
    }, []);

    // --- Event Handlers (Simplified) ---
    const handleSubmit = async () => {
        if (!inputMessage.trim()) return;

        const newUserMessage: Message = {
            role: 'user',
            content: inputMessage.trim(),
            timestamp: new Date().toISOString() // Use ISO string for consistency
        };

        // Add user message to state immediately
        setMessages(prev => [...prev, newUserMessage]);
        const currentMessages = [...messages, newUserMessage]; // Use this for API call
        const previousInput = inputMessage;
        setInputMessage(''); // Clear input

        try {
            setIsLoading(true);
            // Prepare messages for the API (usually just role and content)
            const messagesForApi = currentMessages.map(m => ({ role: m.role, content: m.content }));

            // Assume API '/api/chat' still exists and works without user context
            const aiResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesForApi }), // Send the messages array
                signal: abortControllerRef.current?.signal
            });

            if (!aiResponse.ok) {
                const errorData = await aiResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `AI request failed: ${aiResponse.statusText}`); // More specific error
            }
            const aiData = await aiResponse.json();

            if (!aiData.response) {
                 throw new Error("Empty response content from AI.");
            }

            const aiContent = aiData.response;

            const newAIMessage: Message = {
                role: 'assistant',
                content: aiContent,
                timestamp: new Date().toISOString()
            };

            // Update state with the AI response - Append to the latest state
            setMessages(prev => [...prev, newAIMessage]);

        } catch (error: any) {
            console.error('Chat error:', error);
            toast.error(`Error: ${error.message}`);
            // Rollback: Remove the optimistically added user message
            setMessages(prev => prev.filter(msg => msg !== newUserMessage));
            setInputMessage(previousInput); // Restore input field
        } finally {
            setIsLoading(false);
        }
    };


     const handleVoiceRecording = async () => {
        try {
            if (isRecording) {
                setIsLoading(true);
                toast("Processing audio...");
                const audioBlob = await stopRecording();

                 // --- START DEBUG LOGGING ---
                 console.log("Audio Blob Details:", {
                    exists: !!audioBlob,
                    size: audioBlob?.size,
                    type: audioBlob?.type
                 });
                 // --- END DEBUG LOGGING ---

                 if (!audioBlob || audioBlob.size < 1000) { // Check for minimal size (e.g., 1KB)
                    console.error('No substantial audio data captured.');
                    toast.error("No clear audio captured. Please try speaking longer.");
                    setIsLoading(false);
                    return; // Stop if blob is empty or too small
                }

                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm'); // Filename helps backend identify type
                // Send current messages for context
                formData.append('messages', JSON.stringify(messages.map(m => ({ role: m.role, content: m.content }))));

                const response = await fetch('/api/voice-chat', {
                     method: 'POST',
                     body: formData,
                     signal: abortControllerRef.current?.signal // Allow cancellation
                 });

                setIsLoading(false); // Stop loading after response or error

                if (!response.ok) {
                    let errorPayload = { 
                        error: `Voice processing failed (${response.status})`, 
                        detail: "Unknown backend error. Check server logs." 
                    }; // Default error structure
                    let rawResponseText = '';

                    try {
                        // 1. Try to get the raw text response first
                        rawResponseText = await response.text(); 
                        
                        // 2. Try to parse it as JSON
                        const parsedJson = JSON.parse(rawResponseText);

                        // 3. Construct a reliable payload object
                        if (typeof parsedJson === 'object' && parsedJson !== null) {
                             errorPayload.error = parsedJson.error || errorPayload.error; // Use parsed error if available
                             errorPayload.detail = parsedJson.detail || rawResponseText.substring(0, 150); // Use detail or fallback to raw text
                        } else {
                             // If parsing gives something other than an object
                             errorPayload.error = `Invalid JSON structure received (${response.status})`;
                             errorPayload.detail = rawResponseText.substring(0, 150);
                        }

                    } catch (parseError) {
                        // If response.text() or JSON.parse() fails
                        console.error("Failed to parse backend error response:", parseError);
                        errorPayload.error = `Non-JSON or unreadable response from backend (${response.status})`;
                        // Use the raw text if available, otherwise indicate parsing failure
                        errorPayload.detail = rawResponseText ? rawResponseText.substring(0, 150) : "Could not read response body.";
                    }

                    console.error("Voice API Error Response (Processed):", errorPayload); // Log the structured error info
                    if (rawResponseText) {
                         console.error("Voice API Raw Response Text:", rawResponseText); // Log raw text for deeper debugging
                    }

                    // Throw a more informative error using the processed payload
                     toast.error(`Voice recording failed: ${errorPayload.error}`); // Show primary error in toast
                     // Add details to the console error for debugging
                     throw new Error(`Voice recording failed: ${errorPayload.error} --- Details: ${errorPayload.detail}`);
                }

                const data = await response.json();

                if (data.transcription && data.reply) {
                    // Add both transcription and reply to messages state
                    const newUserMessage: Message = {
                        role: 'user',
                        content: data.transcription, // Show what the user said
                        timestamp: new Date().toISOString()
                    };
                    const newAIMessage: Message = {
                        role: 'assistant',
                        content: data.reply, // Show the AI's reply
                        timestamp: new Date().toISOString()
                    };
                    // Update state sequentially to ensure order
                    setMessages(prev => [...prev, newUserMessage, newAIMessage]);
                    toast.success("Voice message processed!");
                } else {
                    // Handle cases where transcription or reply might be missing in the response
                    console.error("Missing transcription or reply in response:", data);
                    toast.error("Failed to get full response from voice chat.");
                }

            } else {
                // Start recording logic
                if (typeof window !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
                   toast.error('Microphone access not supported by your browser.');
                   return;
                }
                if (microphoneError) {
                   toast.error(microphoneError);
                   return;
                }
                await startRecording(); // Make sure this handles permissions
                toast.success("Recording started...");
            }
        } catch (error: any) {
             console.error('Voice recording error:', error);
             toast.error(`Voice recording failed: ${error.message}`);
             setIsLoading(false); // Ensure loading stops on error
             if (isRecording) {
                try {
                  await stopRecording(); // Attempt to clean up recording state on error
                } catch (stopError) {
                  console.error("Error stopping recording after failure:", stopError);
                }
             }
        }
    };


    const handleNewChat = () => {
        // Abort existing request if any
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController(); // Re-initialize

        // Reset message display and input
        setMessages([]);
        setInputMessage('');
        setIsLoading(false); // Ensure loading indicator stops

        // --- KEY CHANGE: Ensure current ID is null ---
        // This signals that the next message should create a new history entry
        setCurrentConversationId(null);
        // --- END KEY CHANGE ---

        // Do NOT clear chatHistory state here, keep it visible in sidebar
        // setChatHistory([]); // <-- DO NOT DO THIS

        toast.success("New chat started"); // User feedback
    };

    const handleSelectConversation = (convo: ChatHistory) => {
         if (isLoading) {
            toast.error("Please wait for the current response to finish.");
            return;
        }
        abortControllerRef.current?.abort(); // Abort any pending request if switching convo

        setCurrentConversationId(convo.id);
        // Ensure messages are properly typed and timestamps are handled
        setMessages(convo.messages.map(m => ({ ...m, timestamp: m.timestamp }))); // Adjust timestamp format if needed
        setInputMessage(''); // Clear input when switching
        toast(`Switched to chat: ${convo.title}`);
    };

     // --- Group Chats Function (modified to handle potential Date objects) ---
    const groupChatsByDate = (chats: ChatHistory[]) => {
         const groups: { [key: string]: ChatHistory[] } = {};
         const now = new Date();
         const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
         const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
         const last7DaysStart = new Date(todayStart); last7DaysStart.setDate(last7DaysStart.getDate() - 7); // Go back 7 days
         const thisMonthStart = new Date(todayStart); thisMonthStart.setDate(1);

         // Ensure chats are sorted newest first before grouping
         const sortedChats = [...chats].sort((a, b) => new Date(b.lastUpdated || b.timestamp).getTime() - new Date(a.lastUpdated || a.timestamp).getTime());

         sortedChats.forEach(chat => {
            const chatDate = new Date(chat.lastUpdated || chat.timestamp); // Use lastUpdated preferably
            let groupName = 'Older'; // Default

             if (chatDate >= todayStart) {
                 groupName = 'Today';
             } else if (chatDate >= yesterdayStart) {
                 groupName = 'Yesterday';
             } else if (chatDate >= last7DaysStart) {
                 groupName = 'Previous 7 Days';
             } else if (chatDate >= thisMonthStart) {
                  // Check if it also falls into "Previous 7 Days" to avoid overlap if needed
                  // For simplicity here, we assume distinct ranges work. Adjust logic if strict non-overlap needed.
                 groupName = 'This Month';
             } // else remains 'Older'

             if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(chat);
        });

         // Return groups in desired display order
        const orderedGroups: { [key: string]: ChatHistory[] } = {};
        ['Today', 'Yesterday', 'Previous 7 Days', 'This Month', 'Older'].forEach(key => {
            if (groups[key]) {
                orderedGroups[key] = groups[key];
            }
        });

        return orderedGroups;
    };


    // --- JSX Structure (same as before, using user prop) ---
    // Extracted for brevity, but it's the same layout:
    // Left Sidebar, Main Chat Area, Right Sidebar
    // Use user.avatar, user.name, user.email from props
    // Pass handleLogout from props to the logout button

    const groupedHistory = groupChatsByDate(chatHistory);
     const userDetails = {
        name: staticUser.name,
        avatar: staticUser.avatar
    };

    // --- Filter AI messages ---
    const aiMessages = messages.filter(message => message.role === 'assistant');

  return (
       <div className="flex h-screen bg-[#f4f7f9] dark:bg-gray-900">
            {/* Left Sidebar */}
            <div className={`${leftSidebarCollapsed ? "w-0" : "w-72"} border-r bg-[#ebf0f4] dark:bg-gray-800 flex flex-col overflow-hidden transition-all duration-300`}>
                <div className="p-4">
                    <Button className="w-full justify-start gap-2" variant="outline" onClick={handleNewChat}>
                        <Plus size={16} /> New Chat
                    </Button>
                </div>
                <ScrollArea className="flex-1 px-3">
                   <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                       Chat history is disabled.
                   </div>
                </ScrollArea>
                {/* Static User Display (Simplified - REMOVED POPOVER) */}
                <div className="p-4 border-t bg-white dark:bg-gray-800 dark:border-gray-700 mt-auto"> {/* Added mt-auto */}
                    <div className="flex items-center gap-3">
                         <Avatar className="h-9 w-9">
                             <AvatarImage src={userDetails.avatar} alt={userDetails.name} />
                             <AvatarFallback className="bg-gray-600 text-white">
                                 <User size={18}/>
                             </AvatarFallback>
                         </Avatar>
                         <div className="flex flex-col items-start overflow-hidden"> {/* Added overflow-hidden */}
                             <span className="text-sm font-medium dark:text-white truncate" title={userDetails.name}> {/* Removed max-w */}
                                 {userDetails.name}
                             </span>
                             {/* Removed email display */}
                         </div>
                     </div>
                </div>
             </div>

            {/* Main Chat Area */}
             <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
                {/* Header Bar */}
                <div className="flex items-center justify-between border-b bg-white dark:bg-gray-800 dark:border-gray-700 p-3 h-16">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)} className="h-8 w-8">
                            <ChevronLeft className={`h-5 w-5 transition-transform duration-300 ${leftSidebarCollapsed ? "rotate-180" : ""}`} />
                        </Button>
                        <h1 className="text-lg font-semibold dark:text-white truncate max-w-xs md:max-w-md">
                            {currentConversationId ? (chatHistory.find(c => c.id === currentConversationId)?.title || "Chat") : "New Chat"}
                         </h1>
                    </div>
                    <div className="flex items-center gap-1">
                        <TooltipProvider delayDuration={100}>
                            <div className="flex items-center gap-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-8 w-8">
                                            {!isMounted ? (
                                                <Moon className="h-5 w-5" />
                                            ) : theme === "dark" ? (
                                                <Sun className="h-5 w-5" />
                                            ) : (
                                                <Moon className="h-5 w-5" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Toggle Theme</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)} className="h-8 w-8">
                                            <ChevronRight className={`h-5 w-5 transition-transform duration-300 ${rightSidebarCollapsed ? "rotate-180" : ""}`} />
                                         </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Toggle Details</p></TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>
                 </div>

                {/* Message Display Area */}
                 <ScrollArea className="flex-1 p-4 bg-[#f4f7f9] dark:bg-gray-900"> {/* Changed to dark:bg-gray-900 */}
                    <div className="space-y-6 max-w-4xl mx-auto pb-4"> {/* Added pb-4 */}
                       <AnimatePresence mode="popLayout">
                            {messages.map((message, index) => (
                                <motion.div
                                    key={`${message.timestamp}-${index}`}
                                    initial="hidden" animate="visible" exit="exit"
                                    variants={messageVariants} transition={{ duration: 0.3 }}
                                    layout="position"
                                >
                                    {message.role === 'user' ? (
                                        <div className="flex justify-end items-start gap-3">
                                            <div className="flex flex-col items-end gap-1 max-w-[75%]">
                                                 <div className="bg-blue-600 text-white rounded-xl rounded-br-none p-3 text-sm shadow-md">
                                                    {message.content}
                                                </div>
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                     {/* Ensure timestamp is valid before formatting */}
                                                     {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={userDetails.avatar} />
                                                <AvatarFallback className="bg-gray-100 text-gray-700">
                                                     <User size={16}/>
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={robotImage.src} alt="AI" className="object-cover" />
                                                <AvatarFallback>AI</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col items-start gap-1 max-w-[75%]">
                                                <div className="bg-white dark:bg-gray-700 rounded-xl rounded-bl-none p-3 text-sm shadow-md">
                                                    <p className="dark:text-gray-200">{message.content}</p>
                                                </div>
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Loading indicator */}
                        {isLoading && (
                           <motion.div initial="hidden" animate="visible" variants={loadingVariants} className="flex items-center justify-center gap-2 text-gray-500">
                                <motion.div
                                    className="h-2 w-2 bg-blue-500 rounded-full"
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                                />
                                <motion.div
                                    className="h-2 w-2 bg-blue-500 rounded-full"
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                                />
                                <motion.div
                                    className="h-2 w-2 bg-blue-500 rounded-full"
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                                 />
                                 <span className="text-sm ml-1">AI is thinking...</span>
                            </motion.div>
                        )}
                         {/* Invisible div to ensure scroll area scrolls fully */}
                         <div ref={scrollRef} className="h-1" />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                 <div className="border-t bg-white dark:bg-gray-800 dark:border-gray-700 p-4">
                     <div className="max-w-4xl mx-auto relative">
                        <Textarea
                            placeholder="Type your message or use the microphone..."
                            className="min-h-[50px] max-h-[150px] pr-24 pl-4 py-3 bg-gray-100 dark:bg-gray-700 dark:text-white resize-none rounded-xl border-gray-200 dark:border-gray-600 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            rows={2}
                        />
                         <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex gap-1 items-center">
                             {/* Voice Recording Button & Waveform */}
                             {isRecording ? (
                                 <div className="flex items-center mr-1 p-1 bg-red-100 dark:bg-red-900 rounded-full">
                                    <VoiceWaveform isRecording={isRecording} level={audioLevel} />
                                 </div>
                             ) : null}
                             <TooltipProvider delayDuration={100}>
                                 <Tooltip>
                                     <TooltipTrigger asChild>
                                         <Button
                                            size="icon"
                                            variant={isRecording ? "destructive" : "ghost"}
                                            className={`h-9 w-9 rounded-full ${isRecording ? "animate-pulse" : ""}`}
                                            onClick={handleVoiceRecording}
                                            disabled={!!microphoneError} // Disable if mic error
                                         >
                                            <Mic2 className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                     <TooltipContent><p>{microphoneError || (isRecording ? "Stop Recording" : "Start Recording")}</p></TooltipContent>
                                </Tooltip>
                                 <Tooltip>
                                     <TooltipTrigger asChild>
                                         {/* Send Button */}
                                         <Button
                                            size="icon"
                                            className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={handleSubmit}
                                            disabled={isLoading || !inputMessage.trim()}
                                         >
                                            <Send className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                     <TooltipContent><p>Send Message</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </div>
             </div>

            {/* Right Sidebar (Details) */}
            <div className={`${rightSidebarCollapsed ? "w-0" : "w-80"} border-l bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden transition-all duration-300 flex flex-col`}>
               <div className="flex items-center justify-between p-3 h-16 border-b dark:border-gray-700 flex-shrink-0"> {/* Added flex-shrink-0 */}
                    <h2 className="font-semibold text-md dark:text-white text-center w-full">AI Responses</h2>
                 </div>
                 {/* --- UPDATED CONTENT AREA --- */}
                 <ScrollArea className="flex-1"> {/* Removed padding from ScrollArea */}
                    <div className="p-4 space-y-4"> {/* Added padding and spacing here */}
                       {aiMessages.length > 0 ? (
                           aiMessages.map((message, index) => (
                               <Card key={`${message.timestamp}-${index}`} className="p-3 dark:bg-gray-700 shadow-sm">
                                   <div className="flex gap-3">
                                        {/* Optional: Add a small indicator or number */}
                                        {/* <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs flex-shrink-0 mt-1">
                                            {index + 1}
                                        </div> */}
                                       <div className="flex-1 min-w-0"> {/* Added min-w-0 for proper truncation */}
                                           <div className="flex justify-between items-start mb-1">
                                               {/* Timestamp */}
                                               <h3 className="font-medium text-gray-500 dark:text-gray-400 text-xs">
                                                   {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '...'}
                                               </h3>
                                               {/* Copy Button */}
                                               <TooltipProvider delayDuration={100}>
                                                   <Tooltip>
                                                       <TooltipTrigger asChild>
                                                           <Button
                                                               variant="ghost"
                                                               size="icon"
                                                               className="h-6 w-6 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0" // Prevent button shrinking
                                                               onClick={() => copy(message.content)}
                                                           >
                                                               <Copy className="h-4 w-4" />
                                                           </Button>
                                                       </TooltipTrigger>
                                                       <TooltipContent>
                                                           <p>{copied ? "Copied!" : "Copy response"}</p>
                                                       </TooltipContent>
                                                   </Tooltip>
                                               </TooltipProvider>
                                           </div>
                                           {/* Message Content (Truncated) */}
                                           <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3"> {/* Limits to 3 lines */}
                                               {message.content}
                                           </p>
                                       </div>
                                   </div>
                               </Card>
                           ))
                       ) : (
                           <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-4">
                                AI responses will appear here.
                           </div>
                       )}
                    </div>
                </ScrollArea>
                 {/* --- END UPDATE --- */}
             </div>
    </div>
  );
}


// --- Main Page Component ---
export default function AppRoot() {
    // Directly render DashboardContent as Firebase and auth checks are removed
    return <DashboardContent />;
}


// --- Helper Hook (useCopyToClipboard - assumed definition) ---
const useCopyToClipboard = () => {
    const [copied, setCopied] = React.useState(false);
    const copy = React.useCallback((text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            toast.success("Copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            toast.error("Failed to copy text.");
            console.error('Copy error:', err);
        });
    }, []);
    return { copied, copy };
};

// --- Dynamic Import Wrapper (if needed, but usually not for the main page component) ---
// export default dynamic(() => Promise.resolve(DashboardPage), { ssr: false }); // Usually wrap DashboardContent if separating
