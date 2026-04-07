/** Room types for facility settings (CreateRoom / UI). */
export const ROOM_TYPES = ['General', 'ICU', 'Private', 'Semi-Private', 'Isolation', 'Telemetry', 'Other'] as const;

export type RoomTypeOption = (typeof ROOM_TYPES)[number];

export const DEFAULT_ROOM_TYPE: RoomTypeOption = 'General';
