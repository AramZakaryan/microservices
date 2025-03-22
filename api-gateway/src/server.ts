import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import {createProxyMiddleware} from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import {logger} from "./logger";


dotenv.config();
const app = express();
app.use(cors());

// Middleware to verify JWT and extract roles
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        res.status(401).json({message: "Access denied. No token provided."});
        return
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        (req as any).user = decoded; // Attach user info to request
        next();
    } catch (error) {
        res.status(403).json({message: "Invalid or expired token."});
        return
    }
};

// Middleware to check roles
const authorize = (requiredRole: string) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const user = (req as any).user;

        if (!user || user.role !== requiredRole) {
            res.status(403).json({message: "Forbidden: You do not have permission"});
            return
        }

        next();
    };
};

// request logging middleware
app.use((req, _, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.split(' ')[1] || 'no-token';

    logger.info({
        method: req.method,
        url: req.url,
        token: token.substring(0, 10) + '...', // don't log full token in production
    }, 'Incoming request');

    next();
});

// response logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();

    const originalJson = res.json;

    res.json = function (body: any) {
        const duration = Date.now() - startTime;

        logger.info({
            method: req.method,
            url: req.url,
            status: res.statusCode,
            responseTimeMs: duration,
            responseBody: body,
        }, 'Response sent');

        return originalJson.call(this, body);
    };

    next();
});

app.get('/', (req, res) => {
    logger.info('Root route hit');
    res.status(200).json({serviceName: "api-gateway", version: "0.0.1"});
});

app.get('/health', async (_, res) => {
    try {
        const [user, task] = await Promise.all([
            axios.get(`${process.env.USER_SERVICE_URL}/health`),
            axios.get(`${process.env.TASK_SERVICE_URL}/health`)
        ]);

        res.json({
            service: 'api-gateway',
            userService: user.data,
            taskService: task.data
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'One or more services are unavailable'
        });
    }
});

// Proxy requests to user-service (no authentication required for login)
app.use('/api/users', createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {'^/api/users': ''},
}));

// Proxy requests to task-service (only authenticated users)
app.use('/api/tasks', createProxyMiddleware({
    target: process.env.TASK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {'^/api/tasks': ''},
}))
;

// Admin-only protected routes
app.use('/api/admin', authenticate, authorize('admin'), createProxyMiddleware({
    target: 'http://localhost:3300',
    changeOrigin: true,
    pathRewrite: {'^/api/admin': ''}
}));

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => logger.info(`API Gateway running on port ${PORT}`));
