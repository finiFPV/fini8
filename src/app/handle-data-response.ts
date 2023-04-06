export interface HandleDataResponse {
    status: number,
    accepted: boolean,
    authToken?: string,
    message?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestedData?: any,
}