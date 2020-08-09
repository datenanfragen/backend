module.exports = {
    apps: [
        {
            name: 'backend',
            script: 'src/index.js',
        },
    ],
    deploy: {
        production: {
            user: 'dabcknd',
            host: 'dabcknd.bebhionn.uberspace.de',
            ref: 'origin/master',
            repo: 'https://github.com/datenanfragen/backend.git',
            path: '/home/dabcknd/backend',
            'pre-deploy-local': '',
            'post-deploy': '/home/dabcknd/bin/yarn && /home/dabcknd/bin/yarn prod',
            'pre-setup': '',
        },
    },
};
