// Imports
const express = require('express')
const mime = require('mime-types')
const morgan = require('morgan')
const Sentry = require('@sentry/node')
const sharp = require('sharp')
const winston = require('winston')

// Constants
const PORT = process.env.PORT || 8080

// Derived Constants
const app = express()
const logger = winston.createLogger()

// Sentry Error Reporting
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
})

// DataDog Tracing
const tracer = require('dd-trace')
tracer.init({
    env: process.env.NODE_ENV,
    logInjection: true
}).use('winston').use('express')


if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.Console({ level: process.env.LOGGING_LEVEL || 'silly' }))
} else {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(
                info => `${info.timestamp} ${info.level}${info.label ? ` [${info.label || ''}]` : ''}: ${info.message}`
            )
        ),
        level: process.env.LOGGING_LEVEL || 'silly'
    }))
}

app.use(Sentry.Handlers.requestHandler());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim(), { label: 'HTTP' }) } }));
app.use(express.static(process.cwd() + '/site'));

app.get('/:type/:query', async (req, res) => {
    const rt = req.params.type
    const type = mime.lookup(rt)
    if (type) {
        if (["gif", "jpeg", "jpg", "png", "svg"].indexOf(rt) > -1) {
            var img = Buffer.from(req.params.query, "base64");
        }

        if (rt == "gif") {
            var img = await sharp(img)
            .gif()
            .toBuffer();
        } else if (["jpeg", "jpg"].indexOf(rt) > -1) {
            var img = await sharp(img).jpeg({
                quality: 100,
                chromaSubsampling: '4:4:4',
                mozjpeg: true
            })
            .toBuffer();
        } else if (rt == "png") {
            var img = await sharp(img)
            .png()
            .toBuffer();
        } else if (rt == "svg") {
        } else {
            res.error(`Invalid/Unsupported image type: ${type}`);
        }

        res.setHeader('Content-Type', type)
        res.send(img);
    } else {
        res.error(`Invalid image type: ${type}`);
    }
})

app.listen(PORT, () => {
    logger.info(`Listening on port ${PORT}`, { label: 'HTTP' })
})

module.exports = app;