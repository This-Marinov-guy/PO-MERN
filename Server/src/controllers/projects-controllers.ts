import express from "express";
import { validationResult } from "express-validator";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import HttpError from "../models/Http-error.js";
import Project from "../models/Project.js";
import User from "../models/User.js";

const getProjectById = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const projectId = req.params.projectId;

  let project;
  try {
    project = await Project.findById(projectId);
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not find project", 500)
    );
  }

  if (!project) {
    return next(new HttpError("No such project", 404));
  }

  res.json({ project: project.toObject({ getters: true }) });
};

const getProjectByUserId = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const userId = req.params.userId;

  let userWithProjects;
  try {
    userWithProjects = await User.findById(userId).populate("projects");
  } catch (err) {
    return next(
      new HttpError("Fetching projects failed, please try again", 500)
    );
  }

  if (!userWithProjects || userWithProjects.projects.length === 0) {
    return next(new HttpError("User has no projects", 404));
  }

  res.json({
    projects: userWithProjects.projects.map((p: any) =>
      p.toObject({ getters: true })
    ),
  });
};

const getTasksByProject = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const projectId = req.params.projectId;

  let projectWithTasks;
  try {
    projectWithTasks = await Project.findById(projectId).populate("tasks");
  } catch (err) {
    return next(new HttpError("Fetching tasks failed", 500));
  }

  if (!projectWithTasks) {
    return next(new HttpError("Error with finding project", 404));
  }

  res.json({
    tasks: projectWithTasks.tasks.map((t: any) =>
      t.toObject({ getters: true })
    ),
    projectCreator: projectWithTasks.creator
  });
};

const postFetchCurrentTask = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const taskId = req.body.taskId;
  const projectId = req.params.projectId;

  let project: any;
  let targetTask: any;

  try {
    project = await Project.findById(projectId);
    targetTask = await project.tasks.find((task) => task.id === taskId);
  } catch (err) {
    return next(new HttpError("Something went wrong, please try again", 500));
  }

  res.json({
    targetTask: targetTask.toObject({ getters: true }),
  });
};

const postAddProject = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs, please check your data", 422));
  }

  const { creator,  title, description, } = req.body;

  const createdProject = new Project({
    creator,
    status : 'active',
    title,
    description,
    image: "http://localhost:5000/" + req.file.path,
    tasks: [],
    workers: [],
  });

  let user: any;
  try {
    user = await User.findById(creator);
  } catch (err) {
    return next(
      new HttpError("Creating project failed, please try again", 500)
    );
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
  } catch (err) {
    return next(
      new HttpError("Creating project failed, please try again", 500)
    );
  }

  res.status(201).json({ projectId: createdProject._id });
};

const postAddWorkers = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const { projectId, workers } = req.body;

  if (!projectId) {
    return next(
      new HttpError("Please create a project and then assign it workers", 500)
    );
  }

  let projectOfTask: any;
  try {
    projectOfTask = await Project.findById(projectId);
  } catch (err) {
    return next(new HttpError("Adding workers failed, please try again", 500));
  }

  if (!projectOfTask) {
    return next(
      new HttpError("Could not find a project with provided id", 404)
    );
  }

  let listOfWorkers: any;
  for (let i = 0; i < workers.length; i++) {
    let workerId: any;
    try {
      workerId = await (
        await User.findOne({
          name: workers[i].split(" ")[0],
          surname: workers[i].split(" ")[1],
        })
      )._id;
      listOfWorkers.push(workerId);
    } catch (err) {
      return next(new HttpError("Could not find one of the users", 500));
    }
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    projectOfTask.workers.push(listOfWorkers);
    await projectOfTask.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    return next(new HttpError("Adding workers failed, please try again", 500));
  }
  res.status(201).json({ workers: workers });
};

const postAddFirstTask = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  let { creator, projectId, title, content, level } = req.body;

  if (!title) {
    title = "Nameless";
  }

  if (!projectId) {
    return next(
      new HttpError("Please create a project and then assign it tasks", 500)
    );
  }

  const createdTask = {
    creator,
    status : 'active',
    title,
    content,
    level,
  };

  let projectOfTask: any;
  try {
    projectOfTask = await Project.findById(projectId);
  } catch (err) {
    return next(new HttpError("Creating task failed, please try again", 500));
  }

  if (!projectOfTask) {
    return next(
      new HttpError("Could not find a project with provided id", 404)
    );
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    projectOfTask.tasks.push(createdTask);
    await projectOfTask.save();
    await sess.commitTransaction();
  } catch (err) {
    return next(new HttpError("Creating task failed, please try again", 500));
  }
  res.status(201).json({ task: createdTask });
};

const postAddDirectTask = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  let { creator, title, content, level } = req.body;
  const projectId = req.params.projectId;

  if (!title) {
    title = "Nameless";
  }

  if (!projectId) {
    return next(
      new HttpError("Please create a project and then assign it tasks", 500)
    );
  }

  const createdTask = {
    creator,
    status : 'active',
    title,
    content,
    level,
  };

  let projectOfTask: any;
  try {
    projectOfTask = await Project.findById(projectId);
  } catch (err) {
    return next(new HttpError("Creating task failed, please try again", 500));
  }

  if (!projectOfTask) {
    return next(
      new HttpError("Could not find a project with provided id", 404)
    );
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    projectOfTask.tasks.push(createdTask);
    await projectOfTask.save();
    await sess.commitTransaction();
  } catch (err) {
    return next(
      new HttpError("Creating task failed, please try again later", 500)
    );
  }
  res.status(201).json({ task: createdTask });
};

const patchAbortProject = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const userId = req.body.userId
  const projectId = req.params.projectId;

  let currentUser: any;
  let project: any;
  try {
    project = await Project.findById(projectId);
    currentUser = await User.findById(userId);
  } catch (err) {
    return next(new HttpError("Something went wrong", 500));
  }

  if (!project) {
    return next(new HttpError("Could not find a project with such id", 404));
  }

  if (!currentUser) {
    return next(new HttpError("Could not find you in the database", 404));
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    currentUser.projects.pull(project);
    project.partcipants.pull(currentUser);
    await currentUser.save();
    await project.save();
    await sess.commitTransaction();
  } catch (err) {
    return next(
      new HttpError("Aborting failed, please try again later", 500)
    );
  }
  
  res.status(200).json({ message: "Project aborted" });
};

const patchUpdateTask = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  //remove this if you dont have validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs", 422));
  }

  const { taskId, title, content, level } = req.body;
  const projectId = req.params.projectId;

  let project: any;
  let targetTask: any;

  try {
    project = await Project.findById(projectId);
    targetTask = await project.tasks.find((task) => task.id === taskId);
  } catch (err) {
    return next(new HttpError("Something went wrong, please try again", 500));
  }

  targetTask.title = title;
  targetTask.content = content;
  targetTask.level = level;

  try {
    await project.save();
  } catch (err) {
    return next(new HttpError("Something went wrong, please try again", 500));
  }

  res.status(200).json({ targetTask: targetTask.toObject({ getters: true }) });
};

const deleteProject = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const projectId = req.params.projectId;
  console.log(projectId);
  

  let project: any;
  try {
    project = await Project.findByIdAndDelete(projectId);
  } catch (err) {
    return next(new HttpError("Something went wrong", 500));
  }

  if (!project) {
    return next(new HttpError("Could not find a project with such id", 404));
  }

  fs.unlink(project.image, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Project deleted" });
};

const deleteTask = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const taskId = req.body.taskId;
  const projectId = req.params.projectId;

  let project: any;
  let task: any;
  try {
    task = await Project.findById(projectId).populate("tasks");
  } catch (err) {
    return next(new HttpError("Something went wrong", 500));
  }

  if (!task) {
    return next(new HttpError("Could not find a task", 404));
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await task.remove({ session: sess });
    project.tasks.pull(task);
    await project.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    return next(new HttpError("Something went wrong, please try again", 500));
  }

  res.status(200).json({ message: "Task deleted" });
};

export {
  getProjectById,
  getProjectByUserId,
  getTasksByProject,
  postFetchCurrentTask,
  postAddProject,
  postAddWorkers,
  postAddFirstTask,
  postAddDirectTask,
  patchAbortProject,
  patchUpdateTask,
  deleteProject,
  deleteTask,
};
