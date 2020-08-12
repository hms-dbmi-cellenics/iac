Deployment
===

Before deploying to a new environment, a service account needs to be created in that environment.
The file for that is found in the [iac](https://gitlab.com/biomage/iac/-/blob/master/k8s_configs/worker-access-service-account.yaml) repu under `k8s_configs/worker-access-service-account.yaml`. **Be mindful** of the namespace you are applying the file to.

This is because GitLab uses a separate deploy user for each environment, so the API cannot, by itself, be deployed with a custom service account granting privileges to launch jobs in another environment.

There is a `chart/` directory, which is a one-to-one copy of the default deployment chart supplied by GitLab, **except** that the service account we created above is automatically bound to the deployment, so it can manage jobs.

This will need to be automated and simplified in due course.

Running Locally end to end
=====
Note that end-to-end running locally is not completely supported (no way to connect the worker and the API locally)
What we can do at this stage is to run the local version of the API with the local version of the UI, sending locally
fake worker responses to the API.
Here are all the steps you should follow to configure that:

### 1. Configuring Redis

Make sure you have Redis installed on your machine:

        brew install redis

Launch Redis server on a separate tab in a teerminal:

        ln -sfv /usr/local/opt/redis/*.plist ~/Library/LaunchAgents

Then, start Redis server via 'launchctl':

        launchctl load ~/Library/LaunchAgents/homebrew.mxcl.redis.plist

After that, start Redis server using configuration file:

        redis-server /usr/local/etc/redis.conf

### 2. Start the API
Run `yarn start` to run the API locally, while running Redis from the previous step on a separate terminal tab.
There will be initially a cache error, but after that you should see message saying `connected`.

### 3. Run the UI locally
On a separate terminal inside the UI project, run `yarn start` to start the UI locally. After the UI is launched,
any request from the UI will be automatically forwarded to the API.

### 4. Receive responses back from the worker
At the moment, there is no way to connect the worker and the API. The reason is that SNS is sending back the worker
response on the staging endpoint for the API and there is no easy way to configure AWS to send a response to a
localhost endpoint instead.
What you can do instead is to hit the API localhost workResults endpoint on another terminal tab, sending out
whatever response JSON you expect the worker to return like this:

        http POST http://localhost:3000/v1/workResults <<< '{\"my\": \"json\"}'

Make sure you have http installed.
You also have to make sure that the JSON that you are sending ('{my: json}') is correctly formatted, alternatively
you will need to go and comment out all parts of the code that do validation.