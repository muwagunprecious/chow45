export const mailConfig = {
    provider: process.env.MAIL_PROVIDER,

    from: {
        name: process.env.MAIL_FROM_NAME,
        email: process.env.MAIL_FROM_EMAIL || "",
    },

};