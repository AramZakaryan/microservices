import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI as string)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error(err));

// Entry endpoint
app.get('/', (_, res) => {
    res.status(200).json({serviceName: "task-service", version: "0.0.1"});
});

// Tasks endpoint - Extract user from API Gateway header
app.get('/tasks', (req, res) => {
    const userHeader = req.header('x-user-data');
    let user = null;

    try {
        user = userHeader ? JSON.parse(userHeader) : null;
    } catch (error) {
        console.error("Error parsing x-user-data:", error);
        res.status(400).json({message: "Invalid user data format"});
        return
    }

    if (!user) {
        res.status(401).json({message: "Unauthorized"});
        return
    }

    console.log(`User ${user.user} with role ${user.role} accessed /tasks`);

    // Example: Admin sees all tasks, User sees only their own tasks
    const tasks = user.role === "admin"
        ? [
            {id: 1, title: "Admin Task 1", completed: false, assignedTo: "admin"},
            {id: 2, title: "User Task 2", completed: false, assignedTo: "user"}
        ]
        : [{id: 2, title: "User Task 2", completed: false, assignedTo: "user"}];

    res.json(tasks);
});

const PORT = process.env.PORT || 3300;
app.listen(PORT, () => console.log(`task-service running on port ${PORT}`));
