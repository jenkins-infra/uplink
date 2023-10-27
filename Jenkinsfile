pipeline {
    agent { label 'linux' }

    options {
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(daysToKeepStr: '10'))
        timestamps()
    }

    triggers {
        pollSCM('H * * * *')
    }

    stages { 
        stage('Build & test') {
            steps {
                sh 'make migrate check'
            }
        }

        stage('Containers') {
            when { expression { not { infra.isInfra() } } }
            steps {
                sh 'make container'
            }
        }

        stage('Publish container') {
            when { expression { infra.isInfra() } }
            steps {
                buildDockerAndPublishImage('uplink')
            }
        }
    }
}

// vim: ft=groovy
