import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
app.use(cors());

// Middleware to verify JWT and extract roles
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
         res.status(401).json({ message: "Access denied. No token provided." });
        return
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        (req as any).user = decoded; // Attach user info to request
        next();
    } catch (error) {
         res.status(403).json({ message: "Invalid or expired token." });
        return
    }
};

// Middleware to check roles
const authorize = (requiredRole: string) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const user = (req as any).user;

        if (!user || user.role !== requiredRole) {
             res.status(403).json({ message: "Forbidden: You do not have permission" });
            return
        }

        next();
    };
};

app.get('/', (req, res) => {
    res.status(200).json({ serviceName: "api-gateway", version: "0.0.1" });
});



// Proxy requests to user-service (no authentication required for login)
app.use('/api/users', createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '' },
}));

// Proxy requests to task-service (only authenticated users)
app.use('/api/tasks', authenticate, createProxyMiddleware({
    target: process.env.TASK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/tasks': '' },
    on: {
        proxyReq: (proxyReq, req) => {
            if ((req as any).user) {
                const userData = JSON.stringify((req as any).user);
                proxyReq.setHeader('x-user-data', userData); // Forward user data
            }
        }
    }
}));

// Admin-only protected routes
app.use('/api/admin', authenticate, authorize('admin'), createProxyMiddleware({
    target: 'http://localhost:3300',
    changeOrigin: true,
    pathRewrite: { '^/api/admin': '' }
}));

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
