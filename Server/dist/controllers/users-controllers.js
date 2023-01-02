import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import HttpError from "../models/Http-error.js";
import User from "../models/User.js";
const getCurrentUser = async (req, res, next) => {
    const userId = req.params.userId;
    let user;
    try {
        user = await User.findById(userId);
    }
    catch (err) {
        const error = new HttpError("Could not fetch user", 500);
        return next(error);
    }
    res.json({ user: user.toObject({ getters: true }) });
};
const getUsers = async (req, res, next) => {
    let users;
    try {
        users = await User.find({}, "-password");
    }
    catch (err) {
        const error = new HttpError("Could not fetch users", 500);
        return next(error);
    }
    res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};
const signup = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new HttpError("Invalid inputs passed", 422);
        console.log(error);
        return next(error);
    }
    const { name, surname, age, email, password } = req.body;
    let existingUser;
    try {
        existingUser = await User.findOne({ email: email });
    }
    catch (err) {
        const error = new HttpError("Signing up failed", 500);
        return next(error);
    }
    if (existingUser) {
        const error = new HttpError("User exists already", 422);
        return next(error);
    }
    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 12);
    }
    catch (err) {
        return next(new HttpError("Could not create a new user", 500));
    }
    const createUser = new User({
        name,
        surname,
        age,
        image: "http://localhost:5000/" + req.file.path,
        email,
        password: hashedPassword,
        projects: [],
        chats: [],
    });
    try {
        await createUser.save();
    }
    catch (err) {
        const error = new HttpError("Signing up failed", 500);
        return next(error);
    }
    let token;
    try {
        token = jwt.sign({ userId: createUser.id, email: createUser.email }, process.env.JWT_STRING, { expiresIn: "1h" });
    }
    catch (err) {
        const error = new HttpError("Signing up failed", 500);
        return next(error);
    }
    res
        .status(201)
        .json({ userId: createUser.id, email: createUser.email, token: token });
};
const login = async (req, res, next) => {
    const { email, password } = req.body;
    let existingUser;
    try {
        existingUser = await User.findOne({ email: email });
    }
    catch (err) {
        const error = new HttpError("Logging in failed", 500);
        return next(error);
    }
    if (!existingUser) {
        const error = new HttpError("Invalid credentials", 401);
        return next(error);
    }
    let isValidPassword = false;
    try {
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    }
    catch (err) {
        return next(new HttpError("Could not log you in, please check your credentials", 500));
    }
    if (!isValidPassword) {
        const error = new HttpError("Invalid credentials", 401);
        return next(error);
    }
    let token;
    try {
        token = jwt.sign({ userId: existingUser.id, email: existingUser.email }, process.env.JWT_STRING, { expiresIn: "1h" });
    }
    catch (err) {
        const error = new HttpError("Logging in failed", 500);
        return next(error);
    }
    res
        .status(201)
        .json({ userId: existingUser.id, email: existingUser.email, token: token });
};
export { signup, login, getUsers, getCurrentUser };
//# sourceMappingURL=users-controllers.js.map