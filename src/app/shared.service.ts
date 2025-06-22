import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedService {
  private category: any;

  setCategory(category: any): void {
    this.category = category;
  }

  getCategory(): any {
    return this.category;
  } 
  constructor() { }
}
