import { createContext, useContext } from 'react'

export type ServiceAnnouncement = { id: string; message: string; starts_at: string; ends_at: string }

export const AnnouncementsContext = createContext<ServiceAnnouncement[]>([])
export const useAnnouncements = () => useContext(AnnouncementsContext)
