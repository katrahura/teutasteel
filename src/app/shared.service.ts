import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedService {
  private category: any;
  public lang:any;

  setCategory(category: any): void {
    this.category = category;
  }

  getCategory(): any {
    return this.category;
  } 
  setLang(lang: string):any{
this.lang=lang;
  }
   getLang():string{
    return this.lang;
  }
  constructor() { }
}
