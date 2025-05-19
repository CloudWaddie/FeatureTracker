import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        // Check against credentials in the environment variables
        if (credentials?.username !== process.env.AUTH_USERNAME || credentials?.password !== process.env.AUTH_PASSWORD) {
          // If the credentials are invalid, return null
          return null
        }
        // If the credentials are valid, return a user object
        const user = { id: 1, name: process.env.AUTH_NAME, email: process.env.AUTH_USERNAME }
        // Return the user object
        return user
      }
    })
  ],
});