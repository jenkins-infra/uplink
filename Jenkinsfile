pipeline {
    agent {
        // 'linux' is the (legacy) label used on ci.jenkins.io for "Docker Linux AMD64" while 'linux-amd64-docker' is the label used on infra.ci.jenkins.io
        label 'linux || linux-amd64-docker'
    }

    options {
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(daysToKeepStr: '10'))
    }

    stages {
        stage('Requirements') {
            steps {
                sh 'make --version'
                sh 'docker version'
                sh 'docker-compose version'
            }
        }
        stage('Build & test') {
            steps {
                sh 'make migrate check'
            }
        }

        stage('Container') {
            steps {
                buildDockerAndPublishImage('uplink', [
                    targetplatforms: 'linux/arm64',
                    publishToPrivateAzureRegistry: true,
                    disablePublication: !infra.isInfra(),
                ])
            }
        }
    }
}

// vim: ft=groovy
