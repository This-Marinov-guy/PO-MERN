import { validationResult } from "express-validator";
import mongoose from "mongoose";
import HttpError from "../models/Http-error.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
const getProjectById = async (req, res, next) => {
    const projectId = req.params.pid;
    let project;
    try {
        project = await Project.findById(projectId);
    }
    catch (err) {
        return next(new HttpError("Something went wrong, could not find project", 500));
    }
    if (!project) {
        return next(new HttpError("No such project", 404));
    }
    res.json({ project: project.toObject({ getters: true }) });
};
const getProjectByUserId = async (req, res, next) => {
    const userId = req.params.uid;
    let userWithProjects;
    try {
        userWithProjects = await User.findById(userId).populate("projects");
    }
    catch (err) {
        return next(new HttpError("Fetching projects failed, please try again", 500));
    }
    if (!userWithProjects || userWithProjects.projects.length === 0) {
        return next(new HttpError("User has no projects", 404));
    }
    res.json({
        projects: userWithProjects.projects.map((p) => p.toObject({ getters: true })),
    });
};
const postAddProject = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError("Invalid inputs, please check your data", 422));
    }
    const { creator, title, description } = req.body;
    const createdProject = new Project({
        creator,
        title,
        description,
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Empire_State_Building_%28aerial_view%29.jpg/400px-Empire_State_Building_%28aerial_view%29.jpg",
        tasks: [],
        workers: [],
    });
    let user;
    try {
        user = await User.findById(creator);
    }
    catch (err) {
        return next(new HttpError("Creating project failed, please try again", 500));
    }
    if (!user) {
        return next(new HttpError("Could not find user for provided id", 404));
    }
    try {
        //adding project to user with session
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdProject.save({ session: sess });
        user.projects.push(createdProject);
        await user.save({ session: sess });
        await sess.commitTransaction();
    }
    catch (err) {
        return next(new HttpError("Creating project failed, please try again", 500));
    }
    res.status(201).json({ project: createdProject });
};
const patchUpdateProject = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError("Invalid inputs passed, please change your data", 422));
    }
    const { pid, title, description } = req.body;
    let project;
    try {
        project = await Project.findById(pid);
    }
    catch (err) {
        return next(new HttpError("Something went wrong, please try again", 500));
    }
    project.title = title;
    project.description = description;
    try {
        await project.save();
    }
    catch (err) {
        return next(new HttpError("Something went wrong, please try again", 500));
    }
    res.status(200).json({ project: project.toObject({ getters: true }) });
};
const deleteProject = async (req, res, next) => {
    const projectId = req.params.pid;
    let project;
    try {
        project = await Project.findById(projectId).populate("creator");
    }
    catch (err) {
        return next(new HttpError("Something went wrong", 500));
    }
    if (!project) {
        return next(new HttpError("Could not find a project with such id", 404));
    }
    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await project.remove({ session: sess });
        project.creator.projects.pull(project);
        await project.creator.save({ session: sess });
        await sess.commitTransaction();
    }
    catch (err) {
        return next(new HttpError("Something went wrong, please try again", 500));
    }
    res.status(200).json({ message: "Project deleted" });
};
// request to add workers
export { getProjectById, getProjectByUserId, postAddProject, patchUpdateProject, deleteProject, };
//# sourceMappingURL=projects-controllers.js.map