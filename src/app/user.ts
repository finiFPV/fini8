export interface User {
    email: string,
    pswd: {
        hash: string,
        salt: string
    },
    pfpSeed: string,
    emailVerified: boolean,
    activeVerification: {id: string, code: string} | null
}
