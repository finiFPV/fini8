export interface HandleDataResponse {
    status: number,
    accepted: boolean,
    authToken?: string,
    message?: string,
    requestedData?: unknown,
}