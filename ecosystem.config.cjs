module.exports = {
  apps: [
    {
      name: 'askfordata',
      script: 'python',
      args: 'manage.py runserver 0.0.0.0:3000',
      cwd: '/home/user/webapp',
      env: {
        PYTHONUNBUFFERED: '1',
        GEMINI_API_KEY: 'AIzaSyB_LJ5-Rw5BlLnAt2Avl8eat7RZ-tNiYSY'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 5
    }
  ]
}
