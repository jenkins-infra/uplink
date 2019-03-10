pipeline {
    agent { label 'node' }

    options {
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(daysToKeepStr: '10'))
        timestamps()
    }

    triggers {
        pollSCM('H * * * *')
    }

    stages { 
        stage('Build') {
            steps {
                sh 'npm install'
            }
        }
    }
}

// vim: ft=groovy
