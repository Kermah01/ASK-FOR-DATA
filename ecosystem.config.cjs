module.exports = {
  apps: [
    {
      name: 'askfordata',
      script: 'gunicorn',
      args: 'askfordata.wsgi --bind 0.0.0.0:3000 --workers 3 --timeout 120',
      cwd: '/home/user/webapp',
      env: {
        PYTHONUNBUFFERED: '1',
        DJANGO_DEBUG: 'False',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 5
    }
  ]
}
