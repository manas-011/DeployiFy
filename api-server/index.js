
import express from 'express'
import { generateSlug } from 'random-word-slugs'
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs'
import { Server } from 'socket.io'
import Redis from 'ioredis' 

const app = express()
const PORT = 9000

const subscriber = new Redis(process.env.REDIS_URL)

const io = new Server({ cors: '*' })

io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel)
        socket.emit('message', `Joined ${channel}`)
    })
})

io.listen(9002, () => console.log('Socket Server 9002'))

const ecsClient = new ECSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

const config = {
    CLUSTER: process.env.CLUSTER_NAME,
    TASK: process.env.TASK_NAME
}

app.use(express.json())

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body
    const projectSlug = slug ? slug : generateSlug()

    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['', '', ''],
                securityGroups: ['']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        { name: 'GIT_REPOSITORY__URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug },
                        { name: 'AWS_REGION', value: process.env.AWS_REGION},
                        { name: 'AWS_ACCESS_KEY', value: process.env.AWS_ACCESS_KEY_ID},
                        { name: 'AWS_SECRET_KEY', value: process.env.AWS_SECRET_ACCESS_KEY},
                        { name: 'REDIS_URL', value: process.env.REDIS_URL}
                    ]
                }
            ]
        }
    })

    await ecsClient.send(command);

    return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.localhost:8000` } })

})

async function initRedisSubscribe() {
    console.log('Subscribed to logs....')
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message)
    })
}
initRedisSubscribe()

app.listen(PORT, () => console.log(`API Server Running..${PORT}`))
