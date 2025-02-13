const core = require('@actions/core');
const github = require('@actions/github');
const asana = require('asana');
const execSync = require('child_process').execSync;

async function asanaOperations(
	asanaPAT,
	targets,
	taskId,
	taskComment
) {
	try {
		const client = asana.Client.create({
			defaultHeaders: {'asana-enable': 'new-sections,string_ids'},
			logAsanaChangeWarnings: false
		}).useAccessToken(asanaPAT);

		const task = await client.tasks.findById(taskId);

		targets.forEach(async target => {
			let targetProject = task.projects.find(project => project.name === target.project);
			if (targetProject) {
				let targetSection = await client.sections.findByProject(targetProject.gid)
					.then(sections => sections.find(section => section.name === target.section));
				if (targetSection) {
					await client.sections.addTask(targetSection.gid, {task: taskId});
					core.info(`Moved to: ${target.project}/${target.section}`);
				} else {
					core.error(`Asana section ${target.section} not found.`);
				}
			} else {
				core.info(`This task does not exist in "${target.project}" project`);
			}
		});

		if (taskComment) {
			await client.tasks.addComment(taskId, {
				text: taskComment
			});
			core.info('Added the commit link to the Asana task.');
		}
	} catch (ex) {
		console.error(ex.value);
	}
}

try {
	const ASANA_PAT = core.getInput('asana-pat'),
		TARGETS = core.getInput('targets'),
		TRIGGER_PHRASE = core.getInput('trigger-phrase'),
		TASK_COMMENT = core.getInput('task-comment');

	let taskComment = null,
		targets = TARGETS ? JSON.parse(TARGETS) : [],
		parseAsanaURL = null;

	if (!ASANA_PAT) {
		throw({message: 'ASANA PAT Not Found!'});
	}

	// Get the latest commit message
	const commitMessage = execSync('git log -1 --pretty=%B').toString();

	console.log(`Commit Message: ${commitMessage}`)

	if (TASK_COMMENT) {
		taskComment = `${TASK_COMMENT} ${github.context.payload.repository.html_url}/commit/${github.context.sha}`;
	}

	let parts = commitMessage.split(/:(.+)/);
	console.log(`Parts: ${parts}`); // debug statement
	if(parts[0].trim() + ":" == TRIGGER_PHRASE.trim()) {
		let url = parts[1].trim(); // this is your Asana task URL
		console.log(`URL: ${url}`); // debug statement
		let urlParts = url.split('/');
		console.log(`URL Parts: ${urlParts}`); // debug statement
		let taskId = urlParts[5]; // this will be your Asana task ID
		console.log("Asana task URL: ", url);
		console.log("Asana task ID: ", taskId);

		asanaOperations(ASANA_PAT, targets, taskId, taskComment);
	} else {
		core.info(`Invalid Asana task URL after the trigger phrase ${TRIGGER_PHRASE}`);
	}
} catch (error) {
	core.error(error.message);
}
