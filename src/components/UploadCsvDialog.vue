<template>
    <div>
        <v-dialog v-model="config.model" persistent max-width="400px">
            <v-card>
                <v-card-title>
                    <div class="text-h5 text-center">Upload CSV</div>
                </v-card-title>
                <v-card-text>
                    <v-alert class="upload-alert" 
                        :value="success" 
                        transition="scale-transition" 
                        :color="color" 
                        dark 
                        :icon="icon"
                    >
                        {{uploadHandleMessage}}
                    </v-alert>
                    <form enctype="multipart/form-data">
                        <v-row>
                            <v-col cols="12">
                                <v-file-input
                                    v-model="file"
                                    accept=".csv"
                                    outlined
                                    dense
                                    ref="file"
                                    label="Upload CSV File"
                                    @change="onFileSelect()"
                                ></v-file-input>
                            </v-col>
                        </v-row>
                    </form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="blue darken-1" text @click="config.model = false">
                        Close
                    </v-btn>
                    <v-btn color="blue darken-1" text @click="uploadCsvFile" :disabled="!file">
                        Upload
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
//import axios from 'axios';
import api from './../utils/api';
export default {
    data: () => ({
        file: null,
        success: false,
        uploadHandleMessage: null,
        color: null,
        icon: null
    }),
    props: {
        config: Object
    },
    methods:{
        onFileSelect(){
            if(event.target.files[0]){
                this.file = event.target.files[0];
            }
        },
        uploadCsvFile(){
            if(this.file){
                const formData =  new FormData();
                formData.append('file',this.file);
                api.post('/upload',formData).then(res => {
                    this.color = 'info';
                    this.icon = "mdi mdi-check-circle theme--dark";
                    this.uploadHandleMessage = res.data.message;
                    this.success = true;
                    setTimeout(() => {
                        this.success = false;
                        this.file = null;
                        this.config.model = false;
                    }, 3000);
                }).catch(() => {
                    this.color = 'error';
                    this.icon = "mdi mdi-close-circle theme--dark";
                    this.uploadHandleMessage = "Error in uploading file.";
                    this.success = true;
                    setTimeout(() => {
                        this.success = false;
                    }, 2000);
                })
            }
        }
    }
}
</script>

<style scoped>
.upload-alert{
    font-size: 14px;
    padding: 7px;
}
</style>